import React from "react";
import { Spinner } from "native-base";

import { kubbentTheme } from "../native-base-theme/variables/commonColor";
import Blurmodal from "../components/BlurModal";

export default function Loading() {
  return (
    <Blurmodal goBackByClickingOutside={false}>
      <Spinner color={kubbentTheme.light} size={55} />
    </Blurmodal>
  );
};
