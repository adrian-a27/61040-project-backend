import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface FollowGraphDoc extends BaseDoc {
  follower: ObjectId;
  followee: ObjectId;
}

export interface FollowRequestDoc extends BaseDoc {
  from: ObjectId;
  to: ObjectId;
  status: "PENDING" | "REJECTED" | "ACCEPTED";
  type: "FOLLOW" | "FRIEND";
}

export default class FollowGraphConcept {
  public readonly followGraph = new DocCollection<FollowGraphDoc>("followGraph");
  public readonly requests = new DocCollection<FollowRequestDoc>("followGraphRequests");

  async getRequests(user: ObjectId) {
    return await this.requests.readMany({
      $or: [{ from: user }, { to: user }],
      status: "PENDING",
    });
  }

  async sendRequest(from: ObjectId, to: ObjectId, type: "FOLLOW" | "FRIEND") {
    await this.canSendRequest(from, to, type);
    await this.requests.createOne({ from, to, status: "PENDING", type });
    return { msg: "Sent request!" };
  }

  async acceptRequest(from: ObjectId, to: ObjectId) {
    const request = await this.removePendingRequest(from, to);
    // Following two can be done in parallel, thus we use `void`
    void this.requests.createOne({ from, to, status: "ACCEPTED" });

    if (request.type == "FOLLOW") {
      void this.addFollower(from, to);
    } else {
      void this.addFriend(from, to);
    }

    return { msg: "Accepted request!" };
  }

  async rejectRequest(from: ObjectId, to: ObjectId) {
    await this.removePendingRequest(from, to);
    await this.requests.createOne({ from, to, status: "REJECTED" });
    return { msg: "Rejected request!" };
  }

  async removeRequest(from: ObjectId, to: ObjectId) {
    await this.removePendingRequest(from, to);
    return { msg: "Removed request!" };
  }

  async removeFollower(follower: ObjectId, followee: ObjectId) {
    const edge = await this.followGraph.popOne({ follower, followee });
    if (edge === null) {
      throw new FollowerNotFoundError(follower, followee);
    }
    return { msg: "Unfollowed!" };
  }

  async removeFriend(user: ObjectId, friend: ObjectId) {
    const friendFilter = {
      $or: [
        { follower: user, followee: friend },
        { follower: friend, followee: user },
      ],
    };

    const edges = await this.followGraph.readMany(friendFilter);
    if (edges.length != 2) {
      throw new FriendNotFoundError(user, friend);
    }

    // Non-atomic, but doesn't make a difference in this case
    await this.followGraph.deleteMany(friendFilter);
    return { msg: "Unfriended!" };
  }

  async getFollowers(user: ObjectId) {
    return (await this.followGraph.readMany({ followee: user })).map((edge) => edge.follower);
  }

  async getFollowing(user: ObjectId) {
    return (await this.followGraph.readMany({ follower: user })).map((edge) => edge.followee);
  }

  async getFriends(user: ObjectId) {
    const [followers, following] = [await this.getFollowers(user), await this.getFollowing(user)];
    const followingUserNames = following.map((id) => id.toString());

    return followers.filter((other_user) => followingUserNames.includes(other_user.toString()));
  }

  private addFollower(follower: ObjectId, followee: ObjectId) {
    void this.followGraph.createOne({ follower, followee });
  }

  private addFriend(user1: ObjectId, user2: ObjectId) {
    void this.addFollower(user1, user2);
    void this.addFollower(user2, user1);
  }

  private async removePendingRequest(from: ObjectId, to: ObjectId) {
    const request = await this.requests.popOne({ from, to, status: "PENDING" });
    if (request === null) {
      throw new RequestNotFoundError(from, to);
    }
    return request;
  }

  private async isNotFollowing(u1: ObjectId, u2: ObjectId) {
    const following = await this.followGraph.readOne({ follower: u1, followee: u2 });

    if (following !== null || u1.toString() === u2.toString()) {
      throw new AlreadyFollowingError(u1, u2);
    }
  }

  private async areNotFriends(u1: ObjectId, u2: ObjectId) {
    const friendship = await this.followGraph.readMany({
      $or: [
        { follower: u1, followee: u2 },
        { follower: u2, followee: u1 },
      ],
    });

    if ((friendship !== null && friendship.length === 2) || u1.toString() === u2.toString()) {
      throw new AlreadyFriendsError(u1, u2);
    }
  }

  public async areFriends(u1: ObjectId, u2: ObjectId) {
    const friendship = await this.followGraph.readMany({
      $or: [
        { follower: u1, followee: u2 },
        { follower: u2, followee: u1 },
      ],
    });

    if (friendship.length < 2) {
      throw new FriendNotFoundError(u1, u2);
    }
  }

  private async canSendRequest(u1: ObjectId, u2: ObjectId, type: "FOLLOW" | "FRIEND") {
    type == "FRIEND" ? await this.areNotFriends(u1, u2) : await this.isNotFollowing(u1, u2);

    // check if there is pending request between these users
    const request = await this.requests.readOne({
      from: { $in: [u1, u2] },
      to: { $in: [u1, u2] },
      status: "PENDING",
    });
    if (request !== null) {
      throw new RequestAlreadyExistsError(u1, u2);
    }
  }
}

export class RequestNotFoundError extends NotFoundError {
  constructor(
    public readonly from: ObjectId,
    public readonly to: ObjectId,
  ) {
    super("Request from {0} to {1} does not exist!", from, to);
  }
}

export class RequestAlreadyExistsError extends NotAllowedError {
  constructor(
    public readonly from: ObjectId,
    public readonly to: ObjectId,
  ) {
    super("Request between {0} and {1} already exists!", from, to);
  }
}

export class FriendNotFoundError extends NotFoundError {
  constructor(
    public readonly user1: ObjectId,
    public readonly user2: ObjectId,
  ) {
    super("Friendship between {0} and {1} does not exist!", user1, user2);
  }
}

export class FollowerNotFoundError extends NotFoundError {
  constructor(
    public readonly follower: ObjectId,
    public readonly followee: ObjectId,
  ) {
    super("{0} does not follow {1} does not exist!", follower, followee);
  }
}

export class AlreadyFriendsError extends NotAllowedError {
  constructor(
    public readonly user1: ObjectId,
    public readonly user2: ObjectId,
  ) {
    super("{0} and {1} are already friends!", user1, user2);
  }
}

export class AlreadyFollowingError extends NotAllowedError {
  constructor(
    public readonly follower: ObjectId,
    public readonly followee: ObjectId,
  ) {
    super("{0} is already following {1}!", follower, followee);
  }
}
