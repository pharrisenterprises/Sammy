## Automation-Tool Chrome Plugin

Automation-Tool.

###Supported browsers
For now **Chrome** is supported.

### Development & Dependencies

Development of features and bugfixes is supported in the following environment:

- NodeJS version 20.9.0
- NPM version 10.1.0
- Linux / Mac / windows
- Tested in at least all browser

### How to run & compile?

Below are the list of commands. You can alternatively use yarn instead of npm.
To download the dependencies, clone the repo and then:

- Execute `npm install`
- npm run build
- Execute `npm run build`

## How to install the extension?

Once you have the dist directory (using commands explained above OR "dist" folder from the repo) you can follow the below stesps to load the extension in the browser.

### Adding to Chrome

You can load the dist or the **unpacked extension** by following the steps below:

- In Address bar URL write : [chrome://extensions/](chrome://extensions/) and press enter.
- In top right corner there is switch called **Enable developer** mode if its on its ok, if not switch it on.
- You will see some options enabled below the top bar. Click on the Load extension button and select the **dist** folder that was generated.
- You will see the extension icon in the browser next to address bar.
