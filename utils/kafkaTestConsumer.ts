import { Kafka, Consumer, logLevel } from 'kafkajs';

interface KafkaTestConsumer {
  subscribe: (topic: string) => Promise<void>;
  waitForMessage: (timeoutMs?: number) => Promise<Record<string, unknown>>;
  disconnect: () => Promise<void>;
}

function createKafkaTestConsumer(): KafkaTestConsumer {
  const broker = process.env.KAFKA_BROKER!;
  const kafka = new Kafka({
    clientId: `clinic-test-${Date.now()}`,
    brokers: [broker],
    logLevel: logLevel.NOTHING,
  });

  // unique group ID per consumer instance — no offset sharing between tests
  const consumer: Consumer = kafka.consumer({
    groupId: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });

  let pendingResolve: ((msg: Record<string, unknown>) => void) | null = null;

  async function subscribe(topic: string): Promise<void> {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    void consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value || !pendingResolve) return;
        const payload = JSON.parse(message.value.toString()) as Record<string, unknown>;
        pendingResolve(payload);
        pendingResolve = null;
      },
    });
    // give the consumer time to complete partition assignment before the test fires the API action
    await new Promise<void>((r) => setTimeout(r, 300));
  }

  async function disconnect(): Promise<void> {
    await consumer.disconnect();
  }

  function waitForMessage(timeoutMs = 5000): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Kafka message not received within ${timeoutMs}ms`)),
        timeoutMs,
      );
      pendingResolve = (payload) => {
        clearTimeout(timer);
        resolve(payload);
      };
    });
  }

  return { subscribe, disconnect, waitForMessage };
}

export { createKafkaTestConsumer };
