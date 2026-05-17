type D1Database = any;
type R2Bucket = any;
type VectorizeIndex = any;
type Ai = any;
type Env = any;
type Queue<T = unknown> = {
  send(body: T): Promise<void>;
};
interface QueueRetryOptions {
  delaySeconds?: number;
}
interface WorkflowInstance {
  id: string;
  status(): Promise<{ status: string } | string>;
}
interface Workflow {
  create(options?: {
    id?: string;
    params?: Record<string, unknown>;
  }): Promise<WorkflowInstance>;
  get(id: string): Promise<WorkflowInstance>;
}
type Fetcher = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

interface MessageBatch<T = unknown> {
  messages: Array<{
    body: T;
    ack(): void;
    retry(options?: QueueRetryOptions): void;
  }>;
}

declare class WorkflowEntrypoint<E = unknown> {
  constructor(ctx: unknown, env: unknown);
  protected env: E;
}

interface WorkflowEvent<T = unknown> {
  payload: T;
}

interface WorkflowStep {
  do<T>(name: string, fn: () => Promise<T> | T): Promise<T>;
  sleep(name: string, duration: string): Promise<void>;
}

declare module "drizzle-orm" {
  export const eq: any;
  export const and: any;
  export const inArray: any;
  export const isNull: any;
  export const notInArray: any;
}

declare module "drizzle-orm/d1" {
  export const drizzle: any;
}

declare module "drizzle-orm/sqlite-core" {
  export const integer: any;
  export const sqliteTable: any;
  export const text: any;
}

declare module "@langchain/textsplitters" {
  export class RecursiveCharacterTextSplitter {
    constructor(options?: Record<string, unknown>);
    splitText(text: string): Promise<string[]>;
  }
}
