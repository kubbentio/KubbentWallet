import React from "react";
import LinearGradient from "react-native-linear-gradient";
import { kubbentTheme } from "../native-base-theme/variables/commonColor";
import { Chain } from "../utils/build";
import Color from "color";

export default function KubbentHeader(props: any) {
  return (
    <LinearGradient
      style={[{
        position: "absolute",
        backgroundColor: kubbentTheme.primary
      }, {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
      },]}
      colors={Chain === "mainnet" ? [kubbentTheme.secondary, kubbentTheme.primary] : [kubbentTheme.lightGray, Color(kubbentTheme.lightGray).darken(0.30).hex()]}
    >
      {props?.children}
    </LinearGradient>
  )
}
