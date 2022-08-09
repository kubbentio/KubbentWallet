import React, { useLayoutEffect } from "react";
import { View, Share, StyleSheet } from "react-native";
import Clipboard from "@react-native-community/clipboard";
import { Text, H1, H3, Spinner } from "native-base";
import { RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";

import { ReceiveStackParamList } from "./index";
import { useStoreState } from "../../state/store";
import { lnrpc } from "../../../proto/lightning";
import QrCode from "../../components/QrCode";
import { formatBitcoin } from "../../utils/bitcoin-units";
import Ticker from "../../components/Ticker";
import { smallScreen } from "../../utils/device";
import CopyAddress from "../../components/CopyAddress";
import Container from "../../components/Container";
import Content from "../../components/Content";
import { kubbentTheme } from "../../native-base-theme/variables/commonColor";
import { toast } from "../../utils";

import { useTranslation } from "react-i18next";
import { namespaces } from "../../i18n/i18n.constants";
import { TouchableOpacity } from "react-native-gesture-handler";

interface IReceiveQRProps {
  navigation: StackNavigationProp<ReceiveStackParamList, "ReceiveQr">;
  route: RouteProp<ReceiveStackParamList, "ReceiveQr">;
}
export default function ReceiveQr({ navigation, route }: IReceiveQRProps) {
  const t = useTranslation(namespaces.receive.receiveQr).t;
  const invoice: lnrpc.AddInvoiceResponse = route.params.invoice;
  const transaction = useStoreState((store) => store.transaction.getTransactionByPaymentRequest(invoice.paymentRequest));
  const bitcoinUnit = useStoreState((store) => store.settings.bitcoinUnit);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: t("title"),
      headerBackTitle: t("buttons.back",{ns:namespaces.common}),
      headerShown: false,
    });
  }, [navigation]);

  if (!transaction) {
    return (
      <Container>
        <Content centered style={{ marginTop: -50 }}>
          <Spinner color={kubbentTheme.light} size={55} />
        </Content>
      </Container>
    );
  }

  if (transaction.status === "SETTLED") {
    setTimeout(() => navigation.pop(), 1);
  }

  const onPressPaymentRequest = () => {
    Clipboard.setString(transaction.paymentRequest);
    toast(t("msg.clipboardCopy",{ns:namespaces.common}), undefined, "warning");
  };

  const onQrPress = async () => {
    await Share.share({
      message: "lightning:" + transaction.paymentRequest,
    });
  };

  return (
    <Container>
      <View style={style.container}>
        {/* <H1 style={style.scanThisQr}>Invoice created</H1> */}
        <QrCode size={smallScreen ? 225 : undefined} data={transaction.paymentRequest.toUpperCase()} onPress={onQrPress} />
        {/* <View style={{ width: "89%", marginBottom: 22 }} testID="payment-request-string">
          <CopyAddress text={transaction.paymentRequest} onPress={onPressPaymentRequest} />
        </View> */}
        {transaction.value?.neq(0) &&
          <View style={{marginTop: 15, width: '85%', flexDirection: 'row', alignContent: 'space-between', justifyContent: 'space-between'}}>
            <H3 testID="pay-amount" style={{fontFamily: 'Sora-Regular'}}>Amount</H3>
            <H3 style={{fontFamily: 'Sora-Regular'}}>{formatBitcoin(transaction.value, bitcoinUnit)}</H3>
          </View>
        }
        <View style={{marginTop: 15, width: '85%', flexDirection: 'row', alignContent: 'space-between', justifyContent: 'space-between'}}>
          <H3 testID="pay-amount" style={{fontFamily: 'Sora-Regular'}}>Expires in</H3>
          <H3 style={{fontFamily: 'Sora-Regular'}}><Ticker expire={transaction.expire.toNumber()} /></H3>
        </View>
        <View style={{marginTop: 15, width: '85%'}}>
          <TouchableOpacity onPress={onPressPaymentRequest} style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'row', backgroundColor: 'white', padding: 10, borderRadius: 5}}>
            <Text style={{fontFamily: 'Sora-Regular', textAlign: 'center', color: 'black'}}>Copy Invoice</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Container>
  );
};

const style = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
    padding: 15,
  },
  scanThisQr: {
    marginBottom: 15,
    fontFamily: 'Sora-Regular'
  },
  expires: {
    marginBottom: 6,
    fontFamily: 'Sora-Regular'
  },
  paymentRequest: {
    paddingTop: 6,
    paddingLeft: 18,
    paddingRight: 18,
    paddingBottom: 20,
    fontFamily: 'Sora-Regular'
  },
});
