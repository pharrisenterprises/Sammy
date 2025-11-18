import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Interface defining the shape of the header state
export interface headerState {
  value: boolean; // Indicates whether the icon is closed or not
  isExtensionOpen: boolean; // State of the is Extension Open  
  isPopUp: boolean; // State of the is Extension Open
  contentScreen: string | null;
}

// Initial state of the header slice
const initialStateValue: headerState = {
  value: false,
  isExtensionOpen: false,
  isPopUp: false,
  contentScreen: null,
};

// Create a slice of the Redux store for managing header-related state
const headerSlice = createSlice({
  name: "header",
  initialState: initialStateValue,
  reducers: {
    /**
     * Updates the state of the icon being closed or not.
     * @param state - The current state.
     * @param action - Contains the new state of the icon (boolean).
     */
    closeIcon: (state, action: PayloadAction<boolean>) => {
      state.value = action.payload;
    },
    setIsExtensionOpen: (state, action: PayloadAction<boolean>) => {
      state.isExtensionOpen = action.payload;
    },
    setIsPopUp: (state, action: PayloadAction<boolean>) => {
      state.isPopUp = action.payload;
    },
    setContentScreen: (state, action: PayloadAction<string|null>) => {
      state.contentScreen = action.payload;
    },
  },
});

// Export the action creators
export const {
  closeIcon,
  setIsExtensionOpen,
  setIsPopUp,
  setContentScreen
} = headerSlice.actions;

// Export the reducer
export default headerSlice.reducer;
