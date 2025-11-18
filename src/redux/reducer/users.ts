import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Define the shape of the user state
export interface UserState {
  user: Record<string, any>; // Use a more specific type if the user object structure is known
}

// Initial state of the user slice
const initialState: UserState = {
  user: {},
};

// Create a slice of the Redux store for managing user-related state
const userSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    /**
     * Updates the user object in the state.
     * @param state - The current state.
     * @param action - Contains the new user data.
     */
    setUser: (state, action: PayloadAction<Record<string, any>>) => {
      state.user = action.payload;
    },
  },
});

// Export the action creators
export const { setUser } = userSlice.actions;

// Export the reducer
export default userSlice.reducer;
