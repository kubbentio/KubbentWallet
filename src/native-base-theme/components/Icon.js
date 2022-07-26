// @flow

import variable, { kubbentTheme } from './../variables/commonColor';

export default (variables /* : * */ = variable) => {
  const iconTheme = {
    fontSize: variables.iconFontSize,
    // color: variable.textColor,

    // KUBBENT:
    color: kubbentTheme.light,
  };

  return iconTheme;
};
