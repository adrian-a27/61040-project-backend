import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { BadValuesError, NotAllowedError, NotFoundError } from "./errors";

export interface MusicPlayerDoc extends BaseDoc {
  user: ObjectId;
  queueLocation: number;
  queue: Array<string>;
  isPlaying: Boolean;
}

export default class MusicPlayerConcept {
  public readonly musicPlayers = new DocCollection<MusicPlayerDoc>("musicPlayers");

  public async create(user: ObjectId) {
    const _id = await this.musicPlayers.createOne({ user, queueLocation: 0, queue: [], isPlaying: false });

    return { msg: "Music player successfully created!", musicPlayer: await this.musicPlayers.readOne({ _id }) };
  }

  public async togglePlayback(user: ObjectId) {
    await this.isQueueEmpty(user);
    const musicPlayer = await this.getMusicPlayerByUser(user);
    await this.update(musicPlayer._id, { isPlaying: !musicPlayer.isPlaying });

    return { msg: `Music player playback is now ${musicPlayer.isPlaying ? "paused" : "playing"}.`, playingSong: !musicPlayer.isPlaying ? musicPlayer.queue[musicPlayer.queueLocation] : "" };
  }

  public async skipForward(user: ObjectId) {
    await this.isQueueEmpty(user);
    const musicPlayer = await this.getMusicPlayerByUser(user);
    const updatedCurrentSong = musicPlayer.queueLocation + 1;

    this.isValidQueuePosition(musicPlayer.queue, updatedCurrentSong);
    await this.update(musicPlayer._id, { queueLocation: updatedCurrentSong });

    return { msg: "Skipped forward!", playingSong: musicPlayer.queue[updatedCurrentSong] };
  }

  public async skipBackward(user: ObjectId) {
    await this.isQueueEmpty(user);
    const musicPlayer = await this.getMusicPlayerByUser(user);
    const updatedCurrentSong = musicPlayer.queueLocation - 1;

    this.isValidQueuePosition(musicPlayer.queue, updatedCurrentSong);
    await this.update(musicPlayer._id, { queueLocation: updatedCurrentSong });

    return { msg: "Skipped backwards!", playingSong: musicPlayer.queue[updatedCurrentSong] };
  }

  public async getQueue(user: ObjectId) {
    return (await this.getMusicPlayerByUser(user)).queue;
  }

  public async addToQueue(user: ObjectId, songId: string) {
    const musicPlayer = await this.getMusicPlayerByUser(user);
    musicPlayer.queue.push(songId);

    await this.update(musicPlayer._id, { queue: musicPlayer.queue });

    return { msg: `Song ${songId} added to queue!` };
  }

  public async playSong(user: ObjectId, songId: string) {
    const musicPlayer = await this.getMusicPlayerByUser(user);
    const queueLocation = musicPlayer.queueLocation;
    const queue = musicPlayer.queue;

    if (queue.length !== 0) {
      const newQueue = [...queue.slice(0, queueLocation + 1), songId, ...queue.slice(queueLocation + 1)];
      await this.update(musicPlayer._id, { queue: newQueue, queueLocation: queueLocation + 1, isPlaying: true });
    } else {
      await this.update(musicPlayer._id, { queue: [songId], queueLocation: 0, isPlaying: true });
    }

    return { msg: `Playing song '${songId}'!` };
  }

  async getMusicPlayerByUser(user: ObjectId) {
    const musicPlayer = await this.musicPlayers.readOne({ user });
    if (!musicPlayer) {
      throw new NotFoundError("Music player not found for user!");
    }

    return musicPlayer;
  }

  public isValidQueuePosition(queue: Array<string>, updatedCurrentSong: number) {
    if (updatedCurrentSong < 0) throw new QueueLocationOutOfBoundsError("TOO_SHORT");
    if (updatedCurrentSong >= queue.length) throw new QueueLocationOutOfBoundsError("TOO_LARGE");
  }

  public async isPlaying(user: ObjectId) {
    return (await this.getMusicPlayerByUser(user)).isPlaying;
  }

  public async isQueueEmpty(user: ObjectId) {
    if ((await this.getMusicPlayerByUser(user)).queue.length === 0) {
      throw new EmptyQueueError();
    }
  }

  async update(_id: ObjectId, update: Partial<MusicPlayerDoc>) {
    this.sanitizeUpdate(update);
    await this.musicPlayers.updateOne({ _id }, update);
    return { msg: "Music Player successfully updated!" };
  }

  async delete(_id: ObjectId) {
    await this.musicPlayers.deleteOne({ _id });
    return { msg: "Music player deleted successfully!" };
  }

  private sanitizeUpdate(update: Partial<MusicPlayerDoc>) {
    // Make sure the update cannot change the user.
    const allowedUpdates = ["queueLocation", "queue", "isPlaying"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update '${key}' field!`);
      }
    }
  }
}

export class QueueLocationOutOfBoundsError extends BadValuesError {
  constructor(public readonly location: "TOO_LARGE" | "TOO_SHORT") {
    super("Proposed queue location is {0}!", location.toLowerCase().split("_").join(" "));
  }
}

export class EmptyQueueError extends NotFoundError {
  constructor() {
    super("The queue is currently empty!");
  }
}
