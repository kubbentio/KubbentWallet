import React from "react";
import { Button, Footer, FooterTab, Icon, Text } from "native-base";
import { useNavigation } from "@react-navigation/native";

import { useTranslation } from "react-i18next";
import { namespaces } from "../i18n/i18n.constants";

export default function FooterNav() {
  const navigation = useNavigation();
  const t = useTranslation(namespaces.footerNav).t;

  return (
    <Footer style={{backgroundColor: 'black'}}>
      <FooterTab style={{backgroundColor: 'black'}}>
        <Button testID="FOOTER_RECEIVE" onPress={() => navigation.navigate("Receive")}>
          <Text style={{color: 'white', fontSize: 14,}}>{t("receive")}</Text>
        </Button>
      </FooterTab>
      <FooterTab style={{backgroundColor: 'black'}}>
        <Button testID="FOOTER_SEND" onPress={() => navigation.navigate("Send", { params: { viaSwipe: false }})}>
          <Text style={{color: 'white', fontSize: 14,}}>{t("send")}</Text>
        </Button>
      </FooterTab>
    </Footer>
  );
};