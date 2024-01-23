import {Command} from '@oclif/core'

export default class NextDNS extends Command {
  static args = {}

  static description = 'Update NextDNS profiles with current IP address. See: https://my.nextdns.io'

  static examples = [`$ joeserver-tools nextdns`]

  static flags = {}

  async run(): Promise<void> {
    this.log(`
 ===============================================
|  Updating NextDNS profile linked IP addresses
|  See: https://my.nextdns.io
|  ${new Date().toLocaleString()}
 ===============================================\n`)
    const result: {[key: string]: string} = {}

    this.log(`Updating NextDNS profile ID 689a99`)
    let response = await fetch('https://link-ip.nextdns.io/689a99/ffcdc3227ebd968b')
    result['689a99'] = await response.text()
    this.log(`Response: ${result['689a99']}`)

    this.log(`Updating NextDNS profile ID 9328e5`)
    response = await fetch('https://link-ip.nextdns.io/9328e5/ffcdc3227ebd968b')
    result['9328e5'] = await response.text()
    this.log(`Response: ${result['9328e5']}`)

    this.log(`Done!\n`)
  }
}
