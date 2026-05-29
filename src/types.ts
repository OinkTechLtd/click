export type Task = {
  id: string;
  title: string;
  url: string;
  seconds: number;
  completed?: boolean;
  openedAt?: number;
};

export type ClickLink = {
  version: 1;
  id: string;
  destination: string;
  title: string;
  description: string;
  waitSeconds: number;
  tasks: Task[];
  createdAt: string;
};

export type ShortenerResult = {
  provider: string;
  url: string;
};
