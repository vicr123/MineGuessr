import { writable, type Writable } from "svelte/store";
import * as THREE from "three";
import type { BlueMapApp } from "./BlueMap/BlueMapApp";
import toast from "svelte-french-toast";

export const current_pos: Writable<THREE.Vector3 | null> = writable(null);
export let curr_bluemap: Writable<BlueMapApp | null> = writable(null);

export const toast_style = 'background-color: rgb(28 36 54); color: white; font-family: Minecraft, sans-serif;';

// Disable Vue DevTools
// @ts-ignore
globalThis.__VUE_PROD_DEVTOOLS__ = false;

// TODO MOVE THESE TYPES AND FUNCTIONS TO SOME BETTER PLACE
export const PAGE_SIZE = 10;

export type TopGame = {
    user: {
        id: string;
        user_id: string;
        username: string;
        avatar: string | null;
        labels: string[];
    } | undefined;
    game_id: string;
    date: Date;
    total_score: number;
    total_distance: number;
    total_time: number;
    round_distance: number[];
};

export const GameType = {
    Normal: 0,
    Daily: 1
} as const;
export type GameType = typeof GameType[keyof typeof GameType];

// TODO: Make these arguments into an object
/**
 * Adds a guess marker to the map
 * 
 * @param map The bluemap instance
 * @param pos The position of the marker
 * @param index The index of the marker, often used together with a round index
 */
export function UpdatePOIMarker(map: BlueMapApp, pos: THREE.Vector3, index?: number, icon?: string, classes?: string[], anchor: "bottom" | "center" = 'bottom'): string {
    const name = `current_pos${index !== undefined ? `_${index}` : ''}`;

    console.log('Updating marker', name, pos);

    let _classes = classes ?? [];
    if (_classes.length === 0) _classes.push('current_pos');

    map.popupMarkerSet.updateMarkerFromData(name, {
        position: { x: pos.x + 0.5, y: pos.y, z: pos.z + 0.65 },
        anchor: anchor === 'bottom' ? { x: 18.5, y: 36.5 } : { x: 38, y: 38 },
        label: '',
        detail: '',
        sorting: 1000,
        listed: false,
        icon: icon ?? '/pin-red.svg',
        classes: _classes,
        minDistance: 0,
        maxDistance: 10000000,
        type: 'poi'
    });

    return name;
}

/**
 * Formats a time in seconds to a string
 * 
 * @param time The time in seconds
 * @returns The formatted time (MM:SS)
 */
export function format_time(time: number) {
    if (isNaN(time)) return "00:00";

    // Minutes and seconds, like MM:SS
    let minutes = Math.floor(time / 60);
    let seconds = Math.floor(time % 60);

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Gets the discord avatar url
 * 
 * @param user_id The user id
 * @param avatar_hash The avatar hash
 * @returns The discord avatar url
 */
export function GetDiscordAvatarUrl(user_id: string, avatar_hash: string | null) {
    if (!avatar_hash) {
        const random_index = Math.floor(Math.random() * 5);
        return `https://cdn.discordapp.com/embed/avatars/${random_index}.png`;
    }
    return `https://cdn.discordapp.com/avatars/${user_id}/${avatar_hash}.png`;
}

export async function Discord() {
    try {
        const url = (await (await fetch('/discord/init')).json()).url;
        location.href = url;
    } catch (e) {
        console.error(e);
        toast.error('Something went wrong!', {
            duration: 5000,
            style: toast_style
        });
    }
}