// @flow

import variable, { kubbentTheme } from './../variables/commonColor';

export default (variables /* : * */ = variable) => {
  let textTheme = {
    fontSize: variables.DefaultFontSize,
    fontFamily: variables.fontFamily,
    color: variables.textColor,
    '.note': {
      color: '#a7a7a7',
      fontSize: variables.noteFontSize
    }
  };

  // KUBBENT
  textTheme[".note"].color = kubbentTheme.lightGray;

  return textTheme;
};
