import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { UserState } from "../reducer/users";

// Selector to get the user slice from the root state
const selectUserState = (state: RootState): UserState => state.users;

/**
 * Selector to get the user data from the user state.
 * @returns The user data.
 */
export const selectUser = createSelector(
  selectUserState,
  (userState: UserState) => userState.user
);
