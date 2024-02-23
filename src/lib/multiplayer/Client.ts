import { get, writable, type Writable } from "svelte/store";
import { ROUNDS_PER_MATCH, type GameModule, type location_metadata } from "../../../shared";
import { ServerResponseMessage, Visibility, get_request_type_name, request_type, type Lobby, type MPRound, type Payloads, type PlayerData, type ServerResponse, type State, type WebsocketRequest } from "../../../shared/MP";
import * as THREE from "three";
import { PUBLIC_MP_DEV, PUBLIC_MP_URL } from "$env/static/public";

export class MPClient {
    private ws: WebSocket;

    public metadata: MPClient.Metadata;
    public client_debug: boolean = true;

    public state: Writable<State> = writable("lobby");
    public players: Writable<{ [key: string]: PlayerData }> = writable({});

    public round_index: Writable<number> = writable(0);
    public current_panorama: Writable<number> = writable(0);

    constructor(user_id: string, auth: string) {
        if (this.client_debug) {
            console.debug(`Connecting to: ${MPClient.WS_URL}`);
        }
        this.ws = new WebSocket(MPClient.WS_URL);

        this.metadata = {
            player_id: user_id,
            game_id: undefined,
            auth_session: auth
        };

        this.setup_message_handler();
        this.setup_error_handler();

        this.ws.onopen = () => {
            if (this.client_debug) {
                console.debug("Connection established");
            }
        }
    }

    public static async create(user_id: string, auth: string) {
        const client = new MPClient(user_id, auth);

        // Wait for the connection to be established
        while (client.ws.readyState !== WebSocket.OPEN) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        return client;
    }

    private send_message(type: request_type, payload: Payloads.Any) {
        this.ws.send(JSON.stringify({
            type,
            player_id: this.metadata.player_id,
            _payload: payload,
            game_id: this.metadata.game_id,
            auth_session: this.metadata.auth_session
        } as WebsocketRequest));

        if (this.client_debug) {
            console.debug(`Sent message: ${get_request_type_name(type)}`);
        }
    }

    private setup_message_handler() {
        this.ws.onmessage = (event: MessageEvent) => {
            try {
                const unsafe_data = JSON.parse(event.data) as ServerResponse;
                const result = ServerResponseMessage.safeParse(unsafe_data);

                if (!result.success) {
                    console.error(`Failed to parse message: ${result.error}`);
                    return;
                }

                const data = unsafe_data as ServerResponse;

                const handler = this.message_handler.get(data.type);
                if (handler) {
                    if (this.client_debug) {
                        console.debug(`Received message: ${get_request_type_name(data.type)}`);
                    }

                    handler(data.payload);
                }
                else {
                    console.error(`No handler for message type: ${get_request_type_name(data.type)}`);
                }
            }
            catch (e) {
                console.error(`Failed to parse message: ${e}`);
            }
        }
    }

    private setup_error_handler() {
        this.ws.onerror = (event: Event) => {
            console.error(event);
        }
    }

    public create_game(panoramas: location_metadata[], visibility: Visibility) {
        this.send_message(request_type.CREATE_GAME, {
            panoramas, visibility
        } as Payloads.CreateGame);
    }

    public join_game(game_id: string) {
        this.send_message(request_type.JOIN_GAME, {
            game_id
        } as Payloads.JoinGame);
    }

    public leave_game() {
        this.send_message(request_type.LEAVE_GAME, {});
    }

    public change_ready_status(ready: boolean) {
        this.send_message(request_type.CHANGE_READY_STATUS, {
            ready
        } as Payloads.ChangeReadyStatus);
    }

    public guess_location(location: THREE.Vector2) {
        this.send_message(request_type.GUESS_LOCATION, {
            location
        } as Payloads.GuessLocation);
    }

    public next_round() {
        this.send_message(request_type.GOTO_NEXT_ROUND, {});
    }

    // TODO: Implement these
    private message_handler: Map<request_type, (_payload: Payloads.Any) => void> = new Map([
        [request_type.JOINED_GAME, (_payload) => {
            const payload = _payload as Payloads.JoinedGame;

            this.metadata.game_id = payload.game_id;

            for (const player of payload.players) {
                this.players.update((players) => {
                    players[player.player_id] = {
                        rounds: MPClient.get_empty_rounds(),
                        lobby_ready: player.ready
                    };

                    return players;
                });
            }

            this.state.set("lobby");
        }],
        [request_type.OTHER_PLAYER_JOINED, (_payload) => {
            const payload = _payload as Payloads.OtherPlayerJoined;

            this.players.update((players) => {
                players[payload.player_id] = {
                    rounds: MPClient.get_empty_rounds(),
                    lobby_ready: false
                };

                return players;
            });
        }],
        [request_type.OTHER_PLAYER_READY, (_payload) => {
            const payload = _payload as Payloads.OtherPlayerReady;

            this.players.update((players) => {
                players[payload.player_id].lobby_ready = payload.ready;

                return players;
            });
        }],
        [request_type.NEXT_ROUND, (_payload) => {
            const payload = _payload as Payloads.NextRound;

            this.players.update((players) => {
                for (const player_id in players) {
                    players[player_id]
                        .rounds[payload.round_index]
                        .panorama_id
                        = payload.panorama_id;
                }

                return players;
            });

            this.round_index.set(payload.round_index);
            this.current_panorama.set(payload.panorama_id);

            this.state.set("playing");
        }],
        [request_type.OTHER_PLAYER_GUESSED, (_payload) => {
            const payload = _payload as Payloads.OtherPlayerGuessed;
        }],
        [request_type.ROUND_ENDED, (_payload) => {
            const payload = _payload as Payloads.RoundEnded;

            this.players.update((players) => {
                for (const player_id in players) {
                    players[player_id].rounds[get(this.round_index)] = {
                        ...payload.rounds[player_id],
                        ready_for_next: false
                    };
                }

                return players;
            });

            this.state.set("intermission");
        }],
        [request_type.GAME_FINISHED, (_payload) => {
            const payload = _payload as Payloads.GameFinished;

            this.state.set("finished");
        }],
        [request_type.ABORTED, (_payload) => {
            const payload = _payload as Payloads.Aborted;

            console.error(`Aborted: ${payload.reason}`);

            this.state.set("aborted");
        }],
        [request_type.ERROR, (_payload) => {
            const payload = _payload as Payloads.Error;

            console.error(`Error: ${payload.reason}`);

            this.state.set("error");
        }],
        [request_type.PING, (_payload) => {
            this.send_message(request_type.PING, {});
        }],
        [request_type.ROUND_TIMELIMIT, (_payload) => {
            const payload = _payload as Payloads.RoundTimelimit;

            console.log(`You have ${payload.time / 1000} seconds to guess the location`);
        }],
        [request_type.GOTO_NEXT_ROUND_TIMELIMIT, (_payload) => {
            const payload = _payload as Payloads.GotoNextRoundTimelimit;

            console.log(`You have ${payload.time / 1000} seconds to go to the next round`);
        }],
        [request_type.OTHER_PLAYER_LEFT, (_payload) => {
            const payload = _payload as Payloads.OtherPlayerLeft;

            this.players.update((players) => {
                delete players[payload.player_id];

                return players;
            });
        }]
    ]);
}

export module MPClient {
    export type Metadata = {
        player_id: string,
        game_id: string | undefined,
        auth_session: string
    };

    export const SERVER_URL = `http${PUBLIC_MP_DEV ? '' : 's'}://${PUBLIC_MP_URL}`;
    export const WS_URL = `ws${PUBLIC_MP_DEV ? '' : 's'}://${PUBLIC_MP_URL}`;

    export async function get_lobbies(): Promise<Lobby[]> {
        try {
            const response = await fetch(SERVER_URL + "/lobby");
            if (!response.ok) {
                console.error("Failed to get lobbies");
                return [];
            }

            return response.json();
        }
        catch (e) {
            console.error(`Failed to get lobbies: ${e}`);
            return [];
        }
    }

    export const ROUND_TEMPLATE: GameModule.Round = {
        location: new THREE.Vector2(),
        guess_location: new THREE.Vector2(),
        distance: 0,
        time: 0,
        score: 0,
        panorama_id: 0,
        finished: false
    };

    export function get_empty_rounds(): MPRound[] {
        return Array(ROUNDS_PER_MATCH).fill(ROUND_TEMPLATE).map((round, i) => {
            return {
                ...round,
                ready_for_next: false
            };
        });
    }
}