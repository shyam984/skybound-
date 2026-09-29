// Panel screen registry (keyed by game state).

import { ChallengeSelectScreen } from './challengeSelect.js';
import { NexScreen } from './nexScreen.js';
import { ShopScreen } from './shop.js';
import { MissionsScreen } from './missions.js';
import { IslandPanel } from './islandPanel.js';
import { SettingsScreen } from './settings.js';

export const SCREENS = {
  CHALLENGE_SELECT: ChallengeSelectScreen,
  NEX_COLLECTION: NexScreen,
  SHOP: ShopScreen,
  MISSIONS: MissionsScreen,
  ISLAND: IslandPanel,
  SETTINGS: SettingsScreen,
};
