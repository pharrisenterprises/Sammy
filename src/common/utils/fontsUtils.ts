const fontBaseURL = chrome.runtime.getURL('fonts/');

export const metropolisFonts = `
  @font-face {
    font-family: 'Metropolis';
    src: url('${fontBaseURL}Metropolis-Regular.otf') format('opentype');
    font-weight: 400;
    font-style: normal;
  }
  @font-face {
    font-family: 'Metropolis';
    src: url('${fontBaseURL}Metropolis-SemiBold.otf') format('opentype');
    font-weight: 600;
  }
  @font-face {
    font-family: 'Metropolis';
    src: url('${fontBaseURL}Metropolis-Bold.otf') format('opentype');
    font-weight: 700;
  }
`;
