import FeedConcept from "./concepts/feed";
import FollowGraphConcept from "./concepts/followGraph";
import MessageConcept from "./concepts/message";
import MusicPlayerConcept from "./concepts/musicPlayer";
import PostConcept, { PostDoc } from "./concepts/post";
import StatusConcept, { StatusDoc } from "./concepts/status";
import UserConcept from "./concepts/user";
import WebSessionConcept from "./concepts/websession";

// App Definition using concepts
export const WebSession = new WebSessionConcept();
export const User = new UserConcept();
export const Post = new PostConcept();
export const Status = new StatusConcept();
export const Message = new MessageConcept();
export const PostFeed = new FeedConcept<PostDoc>(Post.posts);
export const StatusFeed = new FeedConcept<StatusDoc>(Status.statuses);
export const MusicPlayer = new MusicPlayerConcept();
export const FollowGraph = new FollowGraphConcept();
