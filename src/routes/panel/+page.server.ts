import { PANEL_PASSWORD } from '$env/static/private';
import { DB } from '$lib/server/db.js';
import { error } from '@sveltejs/kit';

export async function load({ cookies }) {
    const pass = cookies.get('90gqguessr-panel-pass');
    if (!pass || pass !== PANEL_PASSWORD) {
        throw error(401, 'Unauthorized');
    }

    const latest_suggestions = await DB.GetSuggestions(5);
    const latest_games = await DB.GetStats(5);

    return {
        suggestions: latest_suggestions,
        games: latest_games
    }
}