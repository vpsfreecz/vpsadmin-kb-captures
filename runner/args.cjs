function parseArgs(argv) {
  const options = {
    viewport: { width: 1440, height: 1100 },
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      i += 1;
      if (i >= argv.length) {
        throw new Error(`${arg} requires a value`);
      }
      return argv[i];
    };

    switch (arg) {
      case '--cluster':
        options.cluster = value();
        break;
      case '--language':
        options.language = value();
        break;
      case '--scenario':
        options.scenario = value();
        break;
      case '--checkpoint':
        options.checkpoint = value();
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.help) {
    if (!options.cluster) {
      throw new Error('--cluster is required');
    }
    if (!options.language) {
      throw new Error('--language is required');
    }
    if (!['cs', 'en'].includes(options.language)) {
      throw new Error('--language must be cs or en');
    }
  }

  return options;
}

const usage = `Usage:
  bin/capture --cluster SLUG --language cs|en
    [--scenario NAME] [--checkpoint SCENARIO/CHECKPOINT]
`;

module.exports = { parseArgs, usage };
