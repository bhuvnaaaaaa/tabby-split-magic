export interface Participant {
  id: string;
  name: string;
  upiId?: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

export interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  paidById: string;
  splitAmongIds: string[];
  isOverheadFee?: boolean;
}

export interface TransferAction {
  id: string;
  from: string;
  to: string;
  toUpi?: string;
  amount: number;
  isSettled: boolean;
}

export interface TabSession {
  title: string;
  currency: string;
  participants: Participant[];
  items: ExpenseItem[];
  sharedTaxes: number;
  transfers: TransferAction[];
}

export type ParsedTab = Pick<TabSession, "title" | "currency" | "items" | "sharedTaxes"> & {
  participants: Pick<Participant, "id" | "name" | "upiId">[];
};