import * as meow from 'meow';
import { main } from './src/app';

const cli = meow(`
    Usage
      $ npm start -- <options>  

    Options
      --gh-token,    Personal access token used to query repo for open pull requests
      --rds-region,  The region in which to shut down DBs (defaults to us-west-2)
      --cycle,       SHUTDOWN | START (defaults to SHUTDOWN)
      --teams,       Shutdown/Startup DBs for these teams (comma delimited) (ex: meatballs, slytherins)
      --skip-prs,    comma delimited list of PR numbers to skip (ex: 1234, 4321)
`, {
  flags: {
    'rds-region': {
      type: 'string',
      default: 'us-west-2'
    },
    cycle: {
      type: 'string',
      default: 'SHUTDOWN'
    },
    teams: {
      type: 'string'
    },
    skipPrs: {
      type: 'string'
    }
  }
});

(async () => {
  try {
    console.log('flags:');
    const { ghToken: ignored, ...scrubbedFlags } = cli.flags;
    console.log(scrubbedFlags);

    const {
      ghToken,
      rdsRegion,
      cycle,
      teams,
      skipPrs
    } = cli.flags;

    if (!ghToken || !teams) {
      cli.showHelp();
      process.exit(1);
      return;
    }

    await main({
      githubToken: ghToken,
      region: rdsRegion,
      cycle: cycle.map(c => c.toUpperCase()),
      teams: teams.split(',').map(t => t.toUpperCase().trim()).filter(Boolean),
      skipPrs: skipPrs.split(',').map(pr => pr.trim()).filter(Boolean).map(Number)
    })

  } catch (error) {
    console.error('Unhandled Error:');
    console.error(error);
    process.exit(1);
  }
})();