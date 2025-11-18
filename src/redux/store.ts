import { configureStore } from "@reduxjs/toolkit";
import themeSlice from "./themeSlice";
import headerSlice from "./reducer/header";
import userSlice from "./reducer/users"

/**
 * Configures the Redux store with the various slices of state.
 * @returns The configured Redux store.
 */
export const store = configureStore({
  reducer: {
    tailwindTheme: themeSlice,
    header: headerSlice,
    users: userSlice,
  },
});

/**
 * Type representing the root state of the Redux store.
 * Infer the `RootState` type from the store itself.
 */
export type RootState = ReturnType<typeof store.getState>;

/**
 * Type representing the dispatch function for the Redux store.
 * Infer the `AppDispatch` type from the store's dispatch function.
 */
export type AppDispatch = typeof store.dispatch;
