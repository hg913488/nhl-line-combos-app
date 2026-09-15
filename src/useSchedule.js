import { useEffect, useState } from 'react';
import { getJSON } from './data-client.js';

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function useSchedule(date = localDate()) {
  const [state, setState] = useState({ date, games: [], loading: true, error: '' });
  useEffect(() => {
    let active = true;
    setState({ date, games: [], loading: true, error: '' });
    const refresh = () => getJSON(`/api/schedule?date=${date}`, 60000)
      .then(data => { if (active) setState({ date, games: data.games, loading: false, error: '' }); })
      .catch(error => { if (active) setState(s => ({ ...s, loading: false, error: error.message })); });
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => { active = false; clearInterval(timer); };
  }, [date]);
  return state.date === date ? state : { date, games: [], loading: true, error: '' };
}
