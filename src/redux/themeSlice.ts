import { createSlice } from "@reduxjs/toolkit";

/**
 * Initial state for the theme slice.
 * @typedef {Object} InitialState
 * @property {number} value - The current value of the theme state.
 */
/** @type {InitialState} */
const initialStateValue = {
  value: 0,
  response: null,  // Initial response is null
};

/**
 * A Redux slice for managing theme-related state.
 *
 * This slice is responsible for handling the theme state within the application.
 * It currently provides a single action to increment the value of the state.
 *
 * @typedef {Object} ThemeSliceState
 * @property {number} value - The current theme value.
 */

/**
 * The theme slice of the Redux store.
 *
 * @type {import("@reduxjs/toolkit").Slice}
 */
const themeSlice = createSlice({
  name: "tailwindTheme",
  initialState: initialStateValue,
  reducers: {
    /**
     * Increments the current value of the theme state.
     *
     * @param {ThemeSliceState} state - The current state of the theme.
     */
    incremented: (state) => {
      state.value += 1;
    },
  },
});

/**
 * Action creator for the `incremented` action.
 *
 * @type {import("@reduxjs/toolkit").ActionCreator}
 */
export const { incremented } = themeSlice.actions;

/**
 * The reducer function for the theme slice.
 *
 * This reducer handles actions related to the theme state and updates the state accordingly.
 *
 * @type {import("@reduxjs/toolkit").Reducer}
 */
export default themeSlice.reducer;
