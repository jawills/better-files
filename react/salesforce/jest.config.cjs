const { jestConfig } = require("@salesforce/sfdx-lwc-jest/config");
module.exports = {
  ...jestConfig,
  moduleNameMapper: {
    "^lightning/uiEmbedding$":
      "<rootDir>/test/jest-mocks/lightning/uiEmbedding/uiEmbedding",
    ...jestConfig.moduleNameMapper
  }
};
