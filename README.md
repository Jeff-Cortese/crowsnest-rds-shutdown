## Crowsnest RDS Shutdown/Startup tool

```
    Usage
      $ npm start -- <options>  

    Options
      --gh-token,    Personal access token used to query repo for open pull requests
      --rds-region,  The region in which to shut down DBs (defaults to us-west-2)
      --cycle,       SHUTDOWN | START (defaults to SHUTDOWN)
      --teams,       Shutdown/Startup DBs for these teams (comma delimited) (ex: meatballs,slytherins)
      --skip-prs,    Comma delimited list of PR numbers to skip (ex: 1234,4321)
      --yes, y       Don't prompt for confirmation.
```
