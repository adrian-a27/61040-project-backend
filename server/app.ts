import FriendConcept from "./concepts/friend";
import MessageConcept from "./concepts/message";
import PostConcept from "./concepts/post";
import StatusConcept from "./concepts/status";
import UserConcept from "./concepts/user";
import WebSessionConcept from "./concepts/websession";

// App Definition using concepts
export const WebSession = new WebSessionConcept();
export const User = new UserConcept();
export const Post = new PostConcept();
export const Friend = new FriendConcept();
export const Status = new StatusConcept();
export const Message = new MessageConcept();
