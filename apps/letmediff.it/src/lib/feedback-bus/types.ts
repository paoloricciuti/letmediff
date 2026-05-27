export type FeedbackMessage = string[];

export type FeedbackHandler = (message: FeedbackMessage) => void;

export type FeedbackSubscription = {
	unsubscribe: () => Promise<void> | void;
};

export abstract class FeedbackBus {
	abstract publish(id: string, message: FeedbackMessage): Promise<boolean>;
	abstract subscribe(id: string, handler: FeedbackHandler): Promise<FeedbackSubscription>;
}
