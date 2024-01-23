oclif-hello-world
=================

oclif example Hello World CLI

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![CircleCI](https://circleci.com/gh/oclif/hello-world/tree/main.svg?style=shield)](https://circleci.com/gh/oclif/hello-world/tree/main)
[![GitHub license](https://img.shields.io/github/license/oclif/hello-world)](https://github.com/oclif/hello-world/blob/main/LICENSE)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g joeserver-tools
$ joeserver-tools COMMAND
running command...
$ joeserver-tools (--version)
joeserver-tools/0.0.0 linux-x64 node-v21.5.0
$ joeserver-tools --help [COMMAND]
USAGE
  $ joeserver-tools COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`joeserver-tools hello PERSON`](#joeserver-tools-hello-person)
* [`joeserver-tools hello world`](#joeserver-tools-hello-world)
* [`joeserver-tools help [COMMANDS]`](#joeserver-tools-help-commands)
* [`joeserver-tools plugins`](#joeserver-tools-plugins)
* [`joeserver-tools plugins:install PLUGIN...`](#joeserver-tools-pluginsinstall-plugin)
* [`joeserver-tools plugins:inspect PLUGIN...`](#joeserver-tools-pluginsinspect-plugin)
* [`joeserver-tools plugins:install PLUGIN...`](#joeserver-tools-pluginsinstall-plugin-1)
* [`joeserver-tools plugins:link PLUGIN`](#joeserver-tools-pluginslink-plugin)
* [`joeserver-tools plugins:uninstall PLUGIN...`](#joeserver-tools-pluginsuninstall-plugin)
* [`joeserver-tools plugins reset`](#joeserver-tools-plugins-reset)
* [`joeserver-tools plugins:uninstall PLUGIN...`](#joeserver-tools-pluginsuninstall-plugin-1)
* [`joeserver-tools plugins:uninstall PLUGIN...`](#joeserver-tools-pluginsuninstall-plugin-2)
* [`joeserver-tools plugins update`](#joeserver-tools-plugins-update)

## `joeserver-tools hello PERSON`

Say hello

```
USAGE
  $ joeserver-tools hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ oex hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/josephfriesen/joeserver-tools/blob/v0.0.0/src/commands/hello/index.ts)_

## `joeserver-tools hello world`

Say hello world

```
USAGE
  $ joeserver-tools hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ joeserver-tools hello world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/josephfriesen/joeserver-tools/blob/v0.0.0/src/commands/hello/world.ts)_

## `joeserver-tools help [COMMANDS]`

Display help for joeserver-tools.

```
USAGE
  $ joeserver-tools help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for joeserver-tools.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.0.11/src/commands/help.ts)_

## `joeserver-tools plugins`

List installed plugins.

```
USAGE
  $ joeserver-tools plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ joeserver-tools plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.14/src/commands/plugins/index.ts)_

## `joeserver-tools plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ joeserver-tools plugins add plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -s, --silent   Silences yarn output.
  -v, --verbose  Show verbose yarn output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ joeserver-tools plugins add

EXAMPLES
  $ joeserver-tools plugins add myplugin 

  $ joeserver-tools plugins add https://github.com/someuser/someplugin

  $ joeserver-tools plugins add someuser/someplugin
```

## `joeserver-tools plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ joeserver-tools plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ joeserver-tools plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.14/src/commands/plugins/inspect.ts)_

## `joeserver-tools plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ joeserver-tools plugins install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -s, --silent   Silences yarn output.
  -v, --verbose  Show verbose yarn output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ joeserver-tools plugins add

EXAMPLES
  $ joeserver-tools plugins install myplugin 

  $ joeserver-tools plugins install https://github.com/someuser/someplugin

  $ joeserver-tools plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.14/src/commands/plugins/install.ts)_

## `joeserver-tools plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ joeserver-tools plugins link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.
  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ joeserver-tools plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.14/src/commands/plugins/link.ts)_

## `joeserver-tools plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ joeserver-tools plugins remove plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ joeserver-tools plugins unlink
  $ joeserver-tools plugins remove

EXAMPLES
  $ joeserver-tools plugins remove myplugin
```

## `joeserver-tools plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ joeserver-tools plugins reset
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.14/src/commands/plugins/reset.ts)_

## `joeserver-tools plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ joeserver-tools plugins uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ joeserver-tools plugins unlink
  $ joeserver-tools plugins remove

EXAMPLES
  $ joeserver-tools plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.14/src/commands/plugins/uninstall.ts)_

## `joeserver-tools plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ joeserver-tools plugins unlink plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ joeserver-tools plugins unlink
  $ joeserver-tools plugins remove

EXAMPLES
  $ joeserver-tools plugins unlink myplugin
```

## `joeserver-tools plugins update`

Update installed plugins.

```
USAGE
  $ joeserver-tools plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.14/src/commands/plugins/update.ts)_
<!-- commandsstop -->
