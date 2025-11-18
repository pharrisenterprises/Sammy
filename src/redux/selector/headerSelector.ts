import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { headerState } from "../reducer/header";

// Selector to get the header slice from the root state
const headerSelector = (state: RootState): headerState => state["header"];

/**
 * Selector to get the state of the power Extension visibility from the header state.
 * @param state - The root state of the Redux store.
 * @returns The visibility state of the power icon (boolean).
 */
export const selectExtensionOpen = createSelector(
  headerSelector,
  (header: headerState) => header.isExtensionOpen
);

/**
 * Selector to get the state of the power Extension visibility from the header state.
 * @param state - The root state of the Redux store.
 * @returns The visibility state of the power icon (boolean).
 */
export const selectIsPopUp = createSelector(
  headerSelector,
  (header: headerState) => header.isPopUp
);


/**
 * Selector to get the state of the power Extension visibility from the header state.
 * @param state - The root state of the Redux store.
 * @returns The visibility state of the power icon (boolean).
 */
export const selectContentScreen = createSelector(
  headerSelector,
  (header: headerState) => header.contentScreen
);
