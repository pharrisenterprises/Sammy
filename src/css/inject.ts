export const pageCss = `
  :host {
    /* text-color */
    --text-white: #fff;
    --text-black: #000;
    --colorone: #323051;
    --colortwo: #7F7F89;
    --colorthree: #D84040;
    --colorfour: #1f1f1f;
    --colorfive: #777777;

    /* background-color */
    --bg-white: #fff;
    --bg-black: #000;
    --bgone: #323051;
    --bgtwo: #81C9C5;
    --bgthree: #E7FAE8;
    --bgfour: #F2F0FE;
    --bgfive: #7D649E;
    --bgsix: #BEABE3;
    --bgseven: #EFD3D5;
    --bgeight: #4D8C88;

    /* border-color */
    --border-white: #fff;
    --border-black: #000;
    --bordercolorone: #323051;
    --bordercolortwo: #E8E8E8;
  }

  .beforein:before {
      transform: translate(-50%, -50%) scale(1.1);
      background: url(${chrome.runtime.getURL('/icon/box-dots.svg')});
      background-size: cover;
  }

  .beforein.beforein-two:before {
      transform:translate(-50%, -50%) scale(1.3) scaleX(0.9);
      background: url(${chrome.runtime.getURL('/icon/box-dots-two.svg')});
      border-radius: 0px;
      background-repeat: no-repeat;
      background-size: contain;
      background-position: center;
  }
  .custom-checkbox .checkmark:before {
    background: url(${chrome.runtime.getURL('/icon/check.svg')});
    background-size: cover;
    background-repeat: no-repeat;
    display: none;
  }
    
  .screentintimages::before {
    background: url(${chrome.runtime.getURL('/images/screen-tint/chrome_url_controls.svg')});
    background-size: cover;
    object-fit: cover;
    background-repeat: no-repeat;
  }
  
  .custom-border {
    border-bottom: 1px solid #323051;
  }
  
  .oopsss-section {
    background:url(${chrome.runtime.getURL('/images/oopsss-bg.svg')});
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
  }
`;
