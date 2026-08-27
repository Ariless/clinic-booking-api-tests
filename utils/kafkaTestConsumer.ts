import { Kafka, Consumer, logLevel } from 'kafkajs';

// CHANGED 2026-08-24 — first run against a live broker; this helper had never been executed.
//
// Before: every test built its own consumer with a unique groupId, slept 300ms hoping partition
//         assignment had finished, relied on the broker to auto-create the topic, and dropped any
//         message that arrived before waitForMessage() was called.
// After:  one recorder for the whole suite — a single consumer subscribed to every appointment
//         topic, buffering what arrives and handing each test the message it asks for by key.
//         Topics are created up front through the admin client; the group is deleted on stop.
// Why:    three separate defects, all invisible until the suite met a real broker.
//         1. Topic auto-creation is asynchronous. On a clean broker the metadata request that
//            triggers it comes back as "This server does not host this topic-partition", so the
//            first run failed 8/9 and the second 2/9 — the suite was quietly depending on topics
//            left behind by earlier runs. Production brokers normally disable auto-creation, so
//            this was also testing a configuration nobody deploys.
//         2. A consumer group per test is never cleaned up: disconnect() leaves the group behind
//            until offsets retention expires (7 days by default). After six runs the broker held
//            54 groups, rebalances stopped fitting into the 5s wait, and tests failed with
//            "Kafka message not received" — a message that points at the producer while the real
//            cause is test litter on the broker. One group per suite keeps that flat.
//         3. fromBeginning:false means a message published before assignment completes is simply
//            never seen. Waiting on the real GROUP_JOIN event replaces a 300ms guess, and matching
//            on the appointment/series id means a test cannot pass on another test's event.

const APPOINTMENT_TOPICS = [
  'clinic.appointment.booked',
  'clinic.appointment.cancelled',
  'clinic.appointment.confirmed',
  'clinic.appointment.rejected',
  'clinic.appointment.rescheduled',
  'clinic.appointment.completed',
  'clinic.appointment.recurring_booked',
  'clinic.appointment.series_cancelled',
] as const;

type Payload = Record<string, unknown>;
type Match = (payload: Payload) => boolean;

interface Received {
  topic: string;
  payload: Payload;
}

interface Waiter {
  topic: string;
  match: Match;
  resolve: (payload: Payload) => void;
  timer: NodeJS.Timeout;
}

interface EventRecorder {
  /** Resolve with the first message on `topic` matching `match` — buffered ones included. */
  waitFor: (topic: string, match?: Match, timeoutMs?: number) => Promise<Payload>;
  stop: () => Promise<void>;
}

function kafkaClient(clientId: string): Kafka {
  return new Kafka({
    clientId,
    brokers: [process.env.KAFKA_BROKER!],
    logLevel: logLevel.NOTHING,
  });
}

/** Create every appointment topic. Idempotent: existing topics come back as `false`, not an error. */
async function ensureKafkaTopics(): Promise<void> {
  const admin = kafkaClient(`clinic-test-admin-${Date.now()}`).admin();
  await admin.connect();
  try {
    await admin.createTopics({
      topics: APPOINTMENT_TOPICS.map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 })),
      waitForLeaders: true,
    });
  } finally {
    await admin.disconnect();
  }
}

/** Delete consumer groups left by earlier runs of this suite, so the broker does not accumulate them. */
async function cleanupTestConsumerGroups(): Promise<number> {
  const admin = kafkaClient(`clinic-test-cleanup-${Date.now()}`).admin();
  await admin.connect();
  try {
    const groups = await admin.listGroups();
    const stale = groups.groups
      .map((g) => g.groupId)
      .filter((id) => id.startsWith('test-') || id.startsWith('clinic-test-recorder-'));
    if (stale.length === 0) return 0;
    // deleteGroups rejects groups that still have members; ours are all disconnected by now
    await admin.deleteGroups(stale);
    return stale.length;
  } finally {
    await admin.disconnect();
  }
}

async function startEventRecorder(): Promise<EventRecorder> {
  const groupId = `clinic-test-recorder-${Date.now()}`;
  const kafka = kafkaClient(groupId);
  const consumer: Consumer = kafka.consumer({ groupId });

  const buffered: Received[] = [];
  const waiters: Waiter[] = [];

  await consumer.connect();
  for (const topic of APPOINTMENT_TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  // arm the listener before run() — GROUP_JOIN can fire before the await below is reached
  const joined = new Promise<void>((resolve) => {
    consumer.on(consumer.events.GROUP_JOIN, () => resolve());
  });

  void consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      const payload = JSON.parse(message.value.toString()) as Payload;
      if (process.env.KAFKA_RECORDER_DEBUG) {
        console.log(`[recorder] ${topic} ${JSON.stringify(payload)}`);
      }

      const index = waiters.findIndex((w) => w.topic === topic && w.match(payload));
      if (index !== -1) {
        const [waiter] = waiters.splice(index, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(payload);
        return;
      }
      buffered.push({ topic, payload });
    },
  });

  await joined;

  function waitFor(topic: string, match: Match = () => true, timeoutMs = 5000): Promise<Payload> {
    const index = buffered.findIndex((r) => r.topic === topic && match(r.payload));
    if (index !== -1) {
      return Promise.resolve(buffered.splice(index, 1)[0].payload);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const self = waiters.findIndex((w) => w.timer === timer);
        if (self !== -1) waiters.splice(self, 1);
        const seen = buffered.filter((r) => r.topic === topic).length;
        reject(
          new Error(
            `No matching message on ${topic} within ${timeoutMs}ms` +
              (seen ? ` (${seen} non-matching message(s) on that topic were buffered)` : ''),
          ),
        );
      }, timeoutMs);

      waiters.push({ topic, match, resolve, timer });
    });
  }

  async function stop(): Promise<void> {
    for (const waiter of waiters) clearTimeout(waiter.timer);
    waiters.length = 0;
    await consumer.disconnect();
    // the group is now memberless; drop it so repeated runs do not pile up on the broker
    const admin = kafkaClient(`${groupId}-admin`).admin();
    await admin.connect();
    try {
      await admin.deleteGroups([groupId]);
    } catch {
      // a group the broker has not finished releasing is not worth failing a test run over
    } finally {
      await admin.disconnect();
    }
  }

  return { waitFor, stop };
}

export { startEventRecorder, ensureKafkaTopics, cleanupTestConsumerGroups, APPOINTMENT_TOPICS };
export type { EventRecorder };
