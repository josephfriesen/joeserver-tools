import { Command } from '@oclif/core';
import { blue, green } from 'chalk';
import { config as _config } from 'dotenv';
import { isIP } from 'node:net';
import NodeSSH from 'node-ssh';
import ora from 'ora';
import { launch } from 'puppeteer';

class XWT extends Command {
  getContainerIp = async function() {
    const ssh = new NodeSSH();

    this.log(JSON.stringify(process.env, null, 2));
    this.log(JSON.stringify(this.config));

    await ssh.connect({
      host: process.env.SSH_host,
      privateKeyPath: process.env.SSH_privatekey,
      username: process.env.SSH_user,
    });

    const result = await ssh.execCommand('docker exec binhex-delugevpn curl -s ifconfig.me');

    if (result.stderr) {
      throw new Error(result.stderr);
    }

    if (!isIP(result.stdout)) {
      throw new Error('IP address fetch command returned invalid IP address. Stdout: ' + result.stdout);
    }

    return result.stdout;
  }

  img = function(filename) {
    return '/home/joe/cron/update-xwt-seedbox-ip/img/' + filename;
  }

  inputIp = async function(page, ip) {
    const {isUpdate, newValue, oldValue} = await page.evaluate((ip) => {
      const seedboxInput = document.querySelector("input[name='seedboxip']");

      if (!seedboxInput) {
        throw new Error('Seedbox IP input field not found.');
      }

      seedboxInput.scrollIntoView();
      const oldValue = seedboxInput.value;
      const newValue = ip;
      if (seedboxInput.value === ip) {
        return {isUpdate: false, newValue, oldValue};
      }

      seedboxInput.value = ip;
      return {isUpdate: true, newValue, oldValue};
    }, ip);

    this.log(blue('  ==> Old IP address: '), oldValue);
    this.log(blue('  ==> New IP address: '), newValue);

    if (isUpdate) {
      this.log(blue('  Updating IP address'));
      await page.click("input[type='submit']");
    }
  }

  login = async function(page) {
    this.log('\n hello \n');
    await page.focus("input[name='username']");
    await page.keyboard.type(process.env.XWT_user || '');

    await page.focus("input[name='password']");
    await page.keyboard.type(process.env.XWT_pass || '');

    await page.click("input[type='submit']");
  }

  logout = async function(page) {
    await page.goto(`${XWT}/logout.php`);
  }

  run = async function() {
    const {getContainerIp, img, inputIp, login, logout} = this;
    const spinner = ora({
      color: 'blue',
      hideCursor: false,
      text: 'Fetching IP address, opening headless browser, navigating to XWT, updating seedbox IP form value, submitting.',
    }).start();

    this.log(' ============== \n');
    this.log('  Cron job to update XWT seedbox IP address for floating container VPN IP  ');
    this.log('  Timestamp: ' + blue(new Date().toString()));
    this.log(' ============== ');

    spinner.text = 'Getting current IP address from unraid container binhex-delugevpn.';
    this.log(green('Getting current IP address from unraid container binhex-delugevpn.'));
    const ip = await getContainerIp();

    this.log(blue('  ==> IP address: ') + ip);

    spinner.text = 'Opening a headless brower.';
    this.log(green('Opening a headless browser.'));
    const browser = await launch({headless: 'new'});

    spinner.text = 'Launching browser page.';
    this.log(green('Launching browser page.'));
    const page = await browser.newPage();

    spinner.text = 'Navigating to XWT login page.';
    this.log(green('Navigating to XWT login page.'));
    await page.goto(`${XWT}/login.php`, {timeout: 0, waitUntil: 'load'});
    await page.screenshot({path: img('login1.png')});

    spinner.text = 'Entering login credentials.';
    this.log(green('Entering login credentials.'));
    await login(page);
    await page.screenshot({path: img('login2.png')});

    spinner.text = 'Opening profile page.';
    this.log(green('Opening profile page.'));

    spinner.text = 'Checking current seedbox IP value, updating as necessary';
    await inputIp(page, ip);
    await page.screenshot({path: img('profile.png')});

    spinner.text = 'Logging out.';
    this.log(green('Logging out.'));
    await logout(page);
    await page.screenshot({path: img('logout.png')});

    spinner.succeed('Done.');
    this.log(' ======== Done =========\n');
  }

  constructor(argv, config) {
    super(argv, config);
    this.log('constructor');
    _config({path: './xwt.env'});
  }
}

export default XWT;