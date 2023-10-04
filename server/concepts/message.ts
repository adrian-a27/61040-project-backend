import { Filter, ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError } from "./errors";

export interface MessageDoc extends BaseDoc {
  sender: ObjectId;
  recipients: Array<ObjectId>;
  content: string;
}

export default class MessageConcept {
  public readonly messages = new DocCollection<MessageDoc>("messages");

  async sendMessage(sender: ObjectId, recipients: Array<ObjectId>, content: string) {
    const _id = await this.messages.createOne({ sender, recipients, content });
    return { msg: "Message sent!", message: await this.messages.readOne({ _id }) };
  }

  async getMessages(query: Filter<MessageDoc>) {
    const messages = await this.messages.readMany(query, {
      sort: { dateCreated: -1 },
    });

    return messages;
  }

  async getByUser(user: ObjectId) {
    return this.getMessages({
      $or: [{ sender: user }, { recipients: user }],
    });
  }

  async update(_id: ObjectId, update: Partial<MessageDoc>) {
    this.sanitizeUpdate(update);
    await this.messages.updateOne({ _id }, update);
    return { msg: "Message successfully updated!" };
  }

  async delete(_id: ObjectId) {
    await this.messages.deleteOne({ _id });
    return { msg: "Message deleted successfully!" };
  }

  async isSender(user: ObjectId, _id: ObjectId) {
    const message = await this.messages.readOne({ _id });
    if (!message) {
      throw new NotAllowedError(`Message ${_id} does not exist!`);
    }

    if (message.sender.toString() !== user.toString()) {
      throw new MessageSenderNotMatchError(user, _id);
    }
  }

  private sanitizeUpdate(update: Partial<MessageDoc>) {
    // Make sure the update cannot change the sender and recipients.
    for (const key in update) {
      if (key !== "content") {
        throw new NotAllowedError(`Cannot update '${key}' field!`);
      }
    }
  }
}

export class MessageSenderNotMatchError extends NotAllowedError {
  constructor(
    public readonly sender: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the sender of message {1}!", sender, _id);
  }
}
