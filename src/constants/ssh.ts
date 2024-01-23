// tailscale tailfin VPN address for joeserver
// const HOST = '100.124.109.89'
// local IP
const HOST = '192.168.68.179'
const USER = 'root'
const PRIVATE_KEY_PATH = `${process.env.HOME}/.ssh/id_ed25519`

const SSH_CONFIG = {
  host: HOST,
  privateKeyPath: PRIVATE_KEY_PATH,
  username: USER,
}

export default SSH_CONFIG

export {HOST, PRIVATE_KEY_PATH, SSH_CONFIG, USER}
