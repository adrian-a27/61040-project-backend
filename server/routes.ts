import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Friend, Message, Post, Status, User, WebSession } from "./app";
import { MessageDoc } from "./concepts/message";
import { PostDoc, PostOptions } from "./concepts/post";
import { StatusDoc } from "./concepts/status";
import { UserDoc } from "./concepts/user";
import { WebSessionDoc } from "./concepts/websession";
import Responses from "./responses";

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
    return await User.create(username, password);
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
    return await User.delete(user);
  }

  @Router.get("/users/friends")
  async getUserFriends(session: WebSessionDoc) {
    // Will return a list of the current users friends
    throw new Error("Not Implemented");
  }

  @Router.get("/users/followers")
  async getUserFollowers(session: WebSessionDoc) {
    // Will return a list of the current users followers
    throw new Error("Not Implemented");
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
  async createPost(session: WebSessionDoc, content: string, options?: PostOptions) {
    // Turn into a synchronization where the new post is added to the data set in FeedConcept

    const user = WebSession.getUser(session);
    const created = await Post.create(user, content, options);
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
    // Turn into a synchronization where the post is removed from the data set in FeedConcept

    const user = WebSession.getUser(session);
    await Post.isAuthor(user, _id);
    return Post.delete(_id);
  }

  @Router.get("/friends")
  async getFriends(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await User.idsToUsernames(await Friend.getFriends(user));
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: WebSessionDoc, friend: string) {
    const user = WebSession.getUser(session);
    const friendId = (await User.getUserByUsername(friend))._id;
    return await Friend.removeFriend(user, friendId);
  }

  @Router.get("/friend/requests")
  async getRequests(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Responses.friendRequests(await Friend.getRequests(user));
  }

  @Router.post("/friend/requests/:to")
  async sendFriendRequest(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    return await Friend.sendRequest(user, toId);
  }

  @Router.delete("/friend/requests/:to")
  async removeFriendRequest(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    return await Friend.removeRequest(user, toId);
  }

  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: WebSessionDoc, from: string) {
    const user = WebSession.getUser(session);
    const fromId = (await User.getUserByUsername(from))._id;
    return await Friend.acceptRequest(fromId, user);
  }

  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: WebSessionDoc, from: string) {
    const user = WebSession.getUser(session);
    const fromId = (await User.getUserByUsername(from))._id;
    return await Friend.rejectRequest(fromId, user);
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

    if (typeof recipient_usernames !== "string") {
      for (const username in recipient_usernames) {
        recipients.push((await User.getUserByUsername(username))._id);
      }
    } else {
      recipients.push((await User.getUserByUsername(recipient_usernames))._id);
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

  @Router.post("/status")
  async createStatus(session: WebSessionDoc, content: string) {
    const user = WebSession.getUser(session);
    return await Status.create(user, content);
  }

  @Router.patch("/status/:_id")
  async updateStatus(session: WebSessionDoc, _id: ObjectId, update: Partial<StatusDoc>) {
    const user = WebSession.getUser(session);
    await Status.isUser(user, _id);
    return Status.update(_id, update);
  }

  @Router.delete("/status/:_id")
  async removeStatus(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await Status.isUser(user, _id);
    return Status.delete(_id);
  }

  @Router.get("/feed")
  async createFeed(session: WebSessionDoc) {
    // Will return the id for a newly generated Feed
    throw new Error("Not Implemented");
  }

  @Router.patch("/feed")
  async refreshFeed(session: WebSessionDoc) {
    // Will refresh user feed and rerun recommendation rule
    throw new Error("Not Implemented");
  }

  @Router.get("/feed/next")
  async getNextInFeed(session: WebSessionDoc) {
    // Will get next video in user Feed
    throw new Error("Not Implemented");
  }

  @Router.patch("/music/play")
  async startPlayback(session: WebSessionDoc) {
    // Will set currentSong to first in queue iff current song is null
    throw new Error("Not Implemented");
  }

  @Router.patch("/music/pause")
  async stopPlayback(session: WebSessionDoc) {
    // Will set currentSong to null
    throw new Error("Not Implemented");
  }

  @Router.put("/music/skip")
  async skipForward(session: WebSessionDoc) {
    // Will set currentSong to next in queue
    throw new Error("Not Implemented");
  }

  @Router.put("/music/back")
  async skipBackward(session: WebSessionDoc) {
    // Will set currentSong to the previous in queue
    throw new Error("Not Implemented");
  }

  @Router.patch("/music/add/:id")
  async addToQueue(session: WebSessionDoc, id: string) {
    // Will add id to the back of the queue
    throw new Error("Not Implemented");
  }

  @Router.put("/music/play/:id")
  async playSong(session: WebSessionDoc, id: string) {
    // Synchronization: Will set currentSong to id and change status of User
    throw new Error("Not Implemented");
  }
}

export default getExpressRouter(new Routes());
