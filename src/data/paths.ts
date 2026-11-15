import { collection } from 'firebase/firestore';
import { db } from './firebase';

export const playersCol = (uid: string) => collection(db, 'coaches', uid, 'players');
export const pairsCol = (uid: string) => collection(db, 'coaches', uid, 'pairs');
export const matchesCol = (uid: string) => collection(db, 'coaches', uid, 'matches');
export const pointsCol = (uid: string, matchId: string) =>
  collection(db, 'coaches', uid, 'matches', matchId, 'points');
export const emotionsCol = (uid: string, matchId: string) =>
  collection(db, 'coaches', uid, 'matches', matchId, 'emotions');
