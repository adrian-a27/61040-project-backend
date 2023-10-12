import { Filter, ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError } from "./errors";

export interface StatusDoc extends BaseDoc {
  user: ObjectId;
  content: string;
}

export default class StatusConcept {
  public readonly statuses = new DocCollection<StatusDoc>("statuses");

  async create(user: ObjectId, content: string) {
    const _id = await this.statuses.createOne({ user, content });
    return { msg: "Status created!", status: await this.statuses.readOne({ _id }) };
  }

  async getStatus(query: Filter<StatusDoc>) {
    return await this.statuses.readMany(query);
  }

  async getUserStatus(user: ObjectId) {
    return await this.statuses.readOne({ user });
  }

  async update(user: ObjectId, update: Partial<StatusDoc>) {
    this.sanitizeUpdate(update);
    await this.statuses.updateOne({ user }, update);
    return { msg: "Status successfully updated!" };
  }

  async delete(user: ObjectId) {
    await this.statuses.deleteOne({ user });
    return { msg: "Status deleted successfully!" };
  }

  async isUser(user: ObjectId, _id: ObjectId) {
    const status = await this.statuses.readOne({ _id });
    if (!status) {
      throw new NotAllowedError(`Status ${_id} does not exist!`);
    }

    if (status.user.toString() !== user.toString()) {
      throw new StatusUserNotMatchError(user, _id);
    }
  }

  private sanitizeUpdate(update: Partial<StatusDoc>) {
    // Make sure the update cannot change the user.
    for (const key in update) {
      if (key !== "content") {
        throw new NotAllowedError(`Cannot update '${key}' field!`);
      }
    }
  }
}

export class StatusUserNotMatchError extends NotAllowedError {
  constructor(
    public readonly user: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the user associated with status {1}!", user, _id);
  }
}
