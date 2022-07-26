import React, { ReactNode } from "react";
import { Linking, TextStyle } from "react-native";
import { Text } from "native-base";
import { kubbentTheme } from "../native-base-theme/variables/commonColor";

export interface ITextLinkProps {
  url: string;
  children?: ReactNode;
  style?: TextStyle;
}
export default function TextLink({ url, children, style }: ITextLinkProps) {
  return (
    <Text onPress={() => Linking.openURL(url)} style={[{ color: kubbentTheme.link }, style]}>
      {children}
    </Text>
  );
}
