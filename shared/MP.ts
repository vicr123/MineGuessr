import { GameModule, location_metadata } from ".";
import { z } from "zod";

export type Config = {
    panoramas: location_metadata[];
    visibility: Visibility;
    game_creator: string;
};

export const Visibility = {
    PUBLIC: "public",
    PRIVATE: "private"
} as const;
export type Visibility = typeof Visibility[keyof typeof Visibility];

export type State = "lobby" | "playing" | "intermission" | "finished" | "aborted" | "error" | "establishing";

export type MPRound = GameModule.Round & {
    ready_for_next: boolean;
}

export type PlayerData = {
    rounds: MPRound[],
    lobby_ready: boolean
};

export type PlayerLobbyData = {
    player_id: string
    ready: boolean,
};

export const request_type = {
    CREATE_GAME: 0,
    JOIN_GAME: 1,
    JOINED_GAME: 2,
    OTHER_PLAYER_JOINED: 3,
    CHANGE_READY_STATUS: 4,
    OTHER_PLAYER_READY: 5,
    NEXT_ROUND: 6,
    GUESS_LOCATION: 7,
    OTHER_PLAYER_GUESSED: 8,
    ROUND_ENDED: 9,
    GOTO_NEXT_ROUND: 10,
    GAME_FINISHED: 11,
    ABORTED: 12,
    ERROR: 13,
    PING: 14,
    ROUND_TIMELIMIT: 15,
    GOTO_NEXT_ROUND_TIMELIMIT: 16,
    LEAVE_GAME: 17,
    OTHER_PLAYER_LEFT: 18
} as const;
export type request_type = typeof request_type[keyof typeof request_type];

export function get_request_type_name(type: request_type) {
    return Object.keys(request_type).find(key => request_type[key as keyof typeof request_type] === type);
}

export type ServerResponse = {
    type: request_type,
    payload: Payloads.Any
}

export const ServerResponseMessage = z.object({
    type: z.number(),
    payload: z.any()
});

export type WebsocketRequest = {
    type: request_type,
    player_id: string,
    _payload: Payloads.Any,
    game_id?: string,
    auth_session: string
};

export type Lobby = {
    players: PlayerLobbyData[]
    game_id: string
};

// TODO: Make these into schemas and validate?
export module Payloads {
    export type CreateGame = {
        panoramas: location_metadata[],
        visibility: Visibility
    }
    export type JoinGame = {
        game_id: string
    }
    export type JoinedGame = {
        game_id: string,
        players: PlayerLobbyData[]
    }
    export type OtherPlayerJoined = {
        player_id: string
    }
    export type ChangeReadyStatus = {
        ready: boolean
    }
    export type OtherPlayerReady = {
        player_id: string,
        ready: boolean
    }
    export type NextRound = {
        panorama_id: number,
        round_index: number
    }
    export type GuessLocation = {
        location: THREE.Vector2
    }
    export type OtherPlayerGuessed = {
        player_id: string,
    }
    export type RoundEnded = {
        rounds: { [key: string]: GameModule.Round }
    }
    export type GotoNextRound = {};
    export type GameFinished = {
        players: { [key: string]: GameModule.Round[] };
    }
    export type Aborted = {
        reason: string
    }
    export type Error = {
        reason: string
    }
    export type RoundTimelimit = {
        time: number
    }
    export type GotoNextRoundTimelimit = {
        time: number
    };
    export type LeaveGame = {};
    export type OtherPlayerLeft = {
        player_id: string
    }

    export type Any = CreateGame | JoinGame | JoinedGame | OtherPlayerJoined | ChangeReadyStatus | OtherPlayerReady | NextRound | GuessLocation | OtherPlayerGuessed | RoundEnded | GotoNextRound | GameFinished | Aborted | Error | RoundTimelimit | GotoNextRoundTimelimit | LeaveGame | OtherPlayerLeft;
}