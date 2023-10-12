import { Filter, ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { FollowGraph, Message, MusicPlayer, Post, PostFeed, Status, StatusFeed, User, WebSession } from "./app";
import { MessageDoc } from "./concepts/message";
import { PostDoc } from "./concepts/post";
import { StatusDoc } from "./concepts/status";
import { UserDoc } from "./concepts/user";
import { WebSessionDoc } from "./concepts/websession";
import Responses from "./responses";

const POST_FEED_FILTER: (user: ObjectId) => Promise<Filter<PostDoc>> = async (user) => {
  return { author: { $in: await FollowGraph.getFollowing(user) } };
};

const STATUS_FEED_FILTER: (user: ObjectId) => Promise<Filter<StatusDoc>> = async (user) => {
  return { user: { $in: await FollowGraph.getFriends(user) }, content: { $ne: "" } };
};

class Routes {
  @Router.get("/session")
  async getSessionUser(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await User.getUserById(user);
  }

  @Router.get("/users")
  async getUsers() {
    return await User.getUsers();
  }

  @Router.get("/users/:username")
  async getUser(username: string) {
    return await User.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: WebSessionDoc, username: string, password: string) {
    WebSession.isLoggedOut(session);
    const successMessage = await User.create(username, password);
    const _id = successMessage?.user?._id;
    await Status.create(_id!, "");
    await PostFeed.create(_id!, await POST_FEED_FILTER(_id!));
    await StatusFeed.create(_id!, await STATUS_FEED_FILTER(_id!));
    await MusicPlayer.create(_id!);

    return successMessage;
  }

  @Router.patch("/users")
  async updateUser(session: WebSessionDoc, update: Partial<UserDoc>) {
    const user = WebSession.getUser(session);
    return await User.update(user, update);
  }

  @Router.delete("/users")
  async deleteUser(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    WebSession.end(session);

    await PostFeed.delete(user);
    await StatusFeed.delete(user);
    await MusicPlayer.delete(user);
    await Status.delete(user);

    return await User.delete(user);
  }

  @Router.post("/login")
  async logIn(session: WebSessionDoc, username: string, password: string) {
    const u = await User.authenticate(username, password);
    WebSession.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: WebSessionDoc) {
    WebSession.end(session);
    return { msg: "Logged out!" };
  }

  @Router.get("/posts")
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const id = (await User.getUserByUsername(author))._id;
      posts = await Post.getByAuthor(id);
    } else {
      posts = await Post.getPosts({});
    }
    return Responses.posts(posts);
  }

  @Router.post("/posts")
  async createPost(session: WebSessionDoc, content: string) {
    const user = WebSession.getUser(session);
    const created = await Post.create(user, content);

    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  @Router.patch("/posts/:_id")
  async updatePost(session: WebSessionDoc, _id: ObjectId, update: Partial<PostDoc>) {
    const user = WebSession.getUser(session);
    await Post.isAuthor(user, _id);
    return await Post.update(_id, update);
  }

  @Router.delete("/posts/:_id")
  async deletePost(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await Post.isAuthor(user, _id);
    const successMessage = Post.delete(_id);

    return successMessage;
  }

  @Router.get("/posts/feed")
  async getAvailablePosts(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await PostFeed.getAvailable(user, await POST_FEED_FILTER(user), undefined, true);
  }

  @Router.get("/friends")
  async getFriends(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await User.idsToUsernames(await FollowGraph.getFriends(user));
  }

  @Router.get("/followers")
  async getFollowers(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await User.idsToUsernames(await FollowGraph.getFollowers(user));
  }

  @Router.get("/following")
  async getFollowing(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await User.idsToUsernames(await FollowGraph.getFollowing(user));
  }

  @Router.post("/friend/request/:to")
  async sendFriendRequest(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    await User.userExists(toId);
    return await FollowGraph.sendRequest(user, toId, "FRIEND");
  }

  @Router.post("/following/request/:to")
  async sendFollowRequest(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    await User.userExists(toId);
    return await FollowGraph.sendRequest(user, toId, "FOLLOW");
  }

  @Router.post("/user/requests/accept/:from")
  async acceptRequest(session: WebSessionDoc, from: string) {
    const user = WebSession.getUser(session);
    const fromId = (await User.getUserByUsername(from))._id;
    await User.userExists(fromId);
    return await FollowGraph.acceptRequest(fromId, user);
  }

  @Router.post("/user/requests/reject/:from")
  async rejectRequest(session: WebSessionDoc, from: string) {
    const user = WebSession.getUser(session);
    const fromId = (await User.getUserByUsername(from))._id;
    await User.userExists(fromId);
    return await FollowGraph.rejectRequest(fromId, user);
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: WebSessionDoc, friend: string) {
    const user = WebSession.getUser(session);
    const friendId = (await User.getUserByUsername(friend))._id;
    await User.userExists(friendId);
    return await FollowGraph.removeFriend(user, friendId);
  }

  @Router.delete("/followers/:follower")
  async removeFollower(session: WebSessionDoc, follower: string) {
    const user = WebSession.getUser(session);
    const followerId = (await User.getUserByUsername(follower))._id;
    await User.userExists(followerId);
    return await FollowGraph.removeFollower(followerId, user);
  }

  @Router.delete("/following/:followee")
  async stopFollowing(session: WebSessionDoc, followee: string) {
    const user = WebSession.getUser(session);
    const followeeId = (await User.getUserByUsername(followee))._id;
    await User.userExists(followeeId);
    return await FollowGraph.removeFollower(user, followeeId);
  }

  @Router.get("/user/requests")
  async getRequests(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Responses.socialRequests(await FollowGraph.getRequests(user));
  }

  @Router.delete("/user/requests/:to")
  async removeRequest(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    await User.userExists(toId);
    return await FollowGraph.removeRequest(user, toId);
  }

  @Router.get("/messages")
  async getUserMessages(session: WebSessionDoc) {
    const user = await WebSession.getUser(session);
    return await Message.getByUser(user);
  }

  @Router.post("/messages")
  async sendMessage(session: WebSessionDoc, recipient_usernames: Array<string>, content: string) {
    const user = WebSession.getUser(session);
    const recipients: ObjectId[] = [];

    for (let i = 0; i < recipient_usernames.length; i++) {
      const recipient = (await User.getUserByUsername(recipient_usernames[i]))._id;
      await FollowGraph.areFriends(user, recipient);
      recipients.push(recipient);
    }

    return await Message.sendMessage(user, recipients, content);
  }

  @Router.patch("/messages/:_id")
  async editMessage(session: WebSessionDoc, _id: ObjectId, update: Partial<MessageDoc>) {
    const user = WebSession.getUser(session);
    await Message.isSender(user, _id);
    return Message.update(_id, update);
  }

  @Router.delete("/messages/:_id")
  async deleteMessage(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await Message.isSender(user, _id);
    return Message.delete(_id);
  }

  @Router.get("/status")
  async getUserStatus(session: WebSessionDoc) {
    const user = await WebSession.getUser(session);
    return await Status.getUserStatus(user);
  }

  @Router.get("/status/feed")
  async getStatuses(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await StatusFeed.getAvailable(user, await STATUS_FEED_FILTER(user));
  }

  @Router.patch("/music/toggle")
  async togglePlayback(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    const musicPlayerSuccessMessage = await MusicPlayer.togglePlayback(user);
    const statusSuccessMessage = await Status.update(user, { content: musicPlayerSuccessMessage.playingSong ?? "" });
    musicPlayerSuccessMessage.msg += ` ${statusSuccessMessage.msg}`;

    return musicPlayerSuccessMessage;
  }

  @Router.patch("/music/next")
  async skipForward(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    const musicPlayerSuccessMessage = await MusicPlayer.skipForward(user);

    if (!(await MusicPlayer.getMusicPlayerByUser(user)).isPlaying) await MusicPlayer.togglePlayback(user);
    const statusSuccessMessage = await Status.update(user, { content: musicPlayerSuccessMessage.playingSong });

    musicPlayerSuccessMessage.msg += ` ${statusSuccessMessage.msg}`;
    return musicPlayerSuccessMessage;
  }

  @Router.patch("/music/back")
  async skipBackward(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    const musicPlayerSuccessMessage = await MusicPlayer.skipBackward(user);

    if (!(await MusicPlayer.getMusicPlayerByUser(user)).isPlaying) await MusicPlayer.togglePlayback(user);
    const statusSuccessMessage = await Status.update(user, { content: musicPlayerSuccessMessage.playingSong });

    musicPlayerSuccessMessage.msg += ` ${statusSuccessMessage.msg}`;
    return musicPlayerSuccessMessage;
  }

  @Router.get("/music/queue")
  async getQueue(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await MusicPlayer.getQueue(user);
  }

  @Router.patch("/music/queue/add/:songId")
  async addToQueue(session: WebSessionDoc, songId: string) {
    const user = WebSession.getUser(session);
    return await MusicPlayer.addToQueue(user, songId);
  }

  @Router.patch("/music/play/:songId")
  async playSong(session: WebSessionDoc, songId: string) {
    const user = WebSession.getUser(session);
    const musicPlayerSuccessMessage = await MusicPlayer.playSong(user, songId);
    const statusSuccessMessage = await Status.update(user, { content: songId });

    musicPlayerSuccessMessage.msg += ` ${statusSuccessMessage.msg}`;
    return musicPlayerSuccessMessage;
  }
}

export default getExpressRouter(new Routes());
