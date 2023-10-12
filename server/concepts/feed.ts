import { Filter, FindOptions, ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface FeedDoc<ContentDoc extends BaseDoc> extends BaseDoc {
  user: ObjectId;
  seen: ContentDoc[];
  available: ContentDoc[];
}

export default class FeedConcept<ContentDoc extends BaseDoc> {
  public readonly feeds = new DocCollection<FeedDoc<ContentDoc>>("feeds");

  constructor(public readonly data: DocCollection<ContentDoc>) {}

  public async create(user: ObjectId, rule: Filter<ContentDoc>, options?: FindOptions | undefined) {
    const _id = await this.feeds.createOne({ user, seen: [], available: await this.data.readMany(rule, options) });

    return { msg: "Feed successfully created!", feed: await this.feeds.readOne({ _id }) };
  }

  public async getAvailable(user: ObjectId, rule: Filter<ContentDoc>, options?: FindOptions | undefined, shuffle = false) {
    await this.refresh(user, rule, options);
    console.log(await this.data.readMany(rule));
    console.log(rule);
    const output = (await this.getFeedByUser(user)).available;

    return shuffle ? this.shuffle(output) : output;
  }

  async update(_id: ObjectId, update: Partial<FeedDoc<ContentDoc>>) {
    this.sanitizeUpdate(update);
    await this.feeds.updateOne({ _id }, update);
    return { msg: "Feed successfully updated!" };
  }

  async delete(_id: ObjectId) {
    await this.feeds.deleteOne({ _id });
    return { msg: "Feed deleted successfully!" };
  }

  private async refresh(user: ObjectId, rule: Filter<ContentDoc>, options?: FindOptions | undefined) {
    const feed = await this.getFeedByUser(user);
    const _id = feed._id;
    console.log("in refresh");
    await this.update(_id, { available: (await this.data.readMany(rule, options)).filter((item) => !feed.seen.includes(item)) });
  }

  private sanitizeUpdate(update: Partial<FeedDoc<ContentDoc>>) {
    // Make sure the update cannot change the user.
    const allowedUpdates = ["seen", "available"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update '${key}' field!`);
      }
    }
  }

  private shuffle(array: Array<ContentDoc>) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  async getFeedByUser(user: ObjectId) {
    const feed = await this.feeds.readOne({ user });
    if (!feed) {
      throw new NotFoundError("Feed not found for user!");
    }

    return feed;
  }
}
