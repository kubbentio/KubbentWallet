import React, { useState } from "react";
import { StyleSheet, Share, Platform, LayoutAnimation, ScrollView, TouchableOpacity, Animated } from "react-native";
import DialogAndroid from "react-native-dialogs";
import Clipboard from "@react-native-community/clipboard";
import { Card, Text, CardItem, H1, View, Button, Icon } from "native-base";
import { fromUnixTime } from "date-fns";
import MapView, { PROVIDER_DEFAULT } from "react-native-maps";

import Blurmodal from "../components/BlurModal";
import QrCode from "../components/QrCode";
import { capitalize, formatISO, isLong, decryptLNURLPayAesTagMessage, toast, bytesToHexString } from "../utils";
import { formatBitcoin } from "../utils/bitcoin-units"
import { useStoreState, useStoreActions } from "../state/store";
import { extractDescription } from "../utils/NameDesc";
import { smallScreen } from "../utils/device";
import CopyAddress from "../components/CopyAddress";
import { MapStyle } from "../utils/google-maps";
import TextLink from "../components/TextLink";
import { ITransaction } from "../storage/database/transaction";
import { kubbentTheme } from ".././native-base-theme/variables/commonColor";
import { PLATFORM } from "../utils/constants";
import { Alert } from "../utils/alert";

import { useTranslation } from "react-i18next";
import { namespaces } from "../i18n/i18n.constants";
import Container from "../components/Container";
import { SafeAreaView } from "react-native-safe-area-context";

const AnimatedIcon = Animated.createAnimatedComponent(Icon);

interface IMetaDataProps {
  title: string;
  data: string;
  url?: string;
}
function MetaData({ title, data, url }: IMetaDataProps) {
  return (
    <Text
      style={style.detailText}
      onPress={() => {
        Clipboard.setString(data);
        toast("Copied to clipboard", undefined, "warning");
      }}
    >
      <Text style={{ fontFamily: 'Sora-Regular' }}>{title}:{"\n"}</Text>
      {!url && data}
      {url && <TextLink url={url}>{data}</TextLink>}
    </Text>
  );
};

function MetaDataLightningAddress({ title, data: lightningAddress, url }: IMetaDataProps) {
  const getContactByLightningAddress = useStoreState((actions) => actions.contacts.getContactByLightningAddress);
  const syncContact = useStoreActions((actions) => actions.contacts.syncContact);

  const promptLightningAddressContact = () => {
    if (!lightningAddress) {
      return;
    }

    if (getContactByLightningAddress(lightningAddress)) {
      Alert.alert("",`${lightningAddress} is in your contact list!`);
    } else {
      Alert.alert(
        "Add to Contact List",
        `Would you like to add ${lightningAddress} to your contact list?`,
        [{
          text: "No",
          style: "cancel",
        }, {
          text: "Yes",
          style: "default",
          onPress: async () => {
            console.log(lightningAddress);
            const domain = lightningAddress.split("@")[1] ?? "";
            console.log(domain);
            syncContact({
              type: "PERSON",
              domain,
              lnUrlPay: null,
              lnUrlWithdraw: null,
              lightningAddress: lightningAddress,
              lud16IdentifierMimeType: "text/identifier",
              note: "",
            });
          },
        }],
      );
    }
  };

  return (
    <Text
      style={[style.detailText, {}]}
      onPress={() => {
        Clipboard.setString(lightningAddress);
        toast("Copied to clipboard", undefined, "warning");
      }}
    >
      <Text style={{ fontWeight: "bold" }}>{title}:{"\n"}</Text>
      {lightningAddress}
        <TouchableOpacity onPress={promptLightningAddressContact} style={{justifyContent:"center", paddingLeft: 10, paddingRight: 15 }}>
          <Icon onPress={promptLightningAddressContact} style={{  fontSize: 22, marginBottom: -6 }} type="AntDesign" name={getContactByLightningAddress(lightningAddress) !== undefined ? "check" : "adduser"} />
        </TouchableOpacity>
      </Text>
  );
};

export interface ITransactionDetailsProps {
  navigation: any;
  route: any;
}
export default function TransactionDetails({ route, navigation }: ITransactionDetailsProps) {
  const t = useTranslation(namespaces.transactionDetails).t;
  const rHash: string = route.params.rHash;
  const transaction = useStoreState((store) => store.transaction.getTransactionByRHash(rHash));
  const checkOpenTransactions = useStoreActions((store) => store.transaction.checkOpenTransactions);
  const cancelInvoice = useStoreActions((store) => store.receive.cancelInvoice);
  const bitcoinUnit = useStoreState((store) => store.settings.bitcoinUnit);
  const transactionGeolocationMapStyle = useStoreState((store) => store.settings.transactionGeolocationMapStyle);
  const [mapActive, setMapActive] = useState(false);
  const syncTransaction = useStoreActions((store) => store.transaction.syncTransaction);

  const [currentScreen, setCurrentScreen] = useState<"Overview" | "Map">("Overview");

  if (!transaction) {
    console.log("No transaction");
    return (<></>);
  }

  const { name, description } = extractDescription(transaction.description);

  const onQrPress = async () => {
    await Share.share({
      message: "lightning:" + transaction.paymentRequest,
    });
  };

  const onPaymentRequestTextPress = () => {
    Clipboard.setString(transaction.paymentRequest);
    toast(t("msg.clipboardCopy", { ns: namespaces.common }), undefined, "warning");
  };

  const onPressCancelInvoice = async () => {
    // There's a LayoutAnimation.configureNext() in the Transaction store
    // to animate the removal of the invoice if hideArchivedInvoices is `true`.
    // React Native cannot figure out which component(s) should have an
    // animation as both the navigation will pop and the invoice
    // will be removed at approximately the same time.
    // So we delay the cancellation for 35ms.
    setTimeout(async () => {
      await cancelInvoice({ rHash: transaction.rHash });
      await checkOpenTransactions();
    }, 35);
    navigation.pop();
  };

  const onPressSetNote = async () => {
    if (PLATFORM === "android") {
      const result = await DialogAndroid.prompt(null, t("setNoteDialog.text"), {
        defaultValue: transaction.note,
      });
      if (result.action === DialogAndroid.actionPositive) {
        await syncTransaction({
          ...transaction,
          note: result.text?.trim() || null,
        });
      }
    } else {
      Alert.prompt(
        t("setNoteDialog.title"),
        t("setNoteDialog.text"),
        async (text) => {
          await syncTransaction({
            ...transaction,
            note: text || null,
          });
        },
        "plain-text",
        transaction.note ?? undefined,
      )
    }
  }

  let transactionValue: Long;
  let direction: "send" | "receive";
  if (isLong(transaction.value) && transaction.value.greaterThanOrEqual(0)) {
    direction = "receive";
    transactionValue = transaction.value;
  }
  else {
    direction = "send";
    transactionValue = transaction.value;
  }

  const hasCoordinates = transaction.locationLat && transaction.locationLong;
  
  if (currentScreen === "Overview") {
    return (
      // <Blurmodal goBackByClickingOutside={true}>
      //   <Card style={style.card}>
      //     <CardItem>
      //       <ScrollView alwaysBounceVertical={false}>
      //         <View style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
      //           <H1 style={style.header}>
      //             {t("title")}
      //           </H1>
      //         </View>
      //         <View style={{ flexDirection: "row", marginTop: 5, marginBottom: 10 }}>
      //           <Button small style={style.actionBarButton} onPress={onPressSetNote}>
      //             <Text style={{fontFamily: 'Sora-ExtraLight', color: 'black'}}>{t("button.setNote")}</Text>
      //           </Button>
                // {transaction.status === "OPEN" &&
                //   <Button small danger onPress={onPressCancelInvoice} style={style.actionBarButton}>
                //     <Text>{t("button.cancelInvoice")}</Text>
                //   </Button>
                // }
      //           {hasCoordinates &&
      //             <Button small={true} onPress={() => {
      //               LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      //               setCurrentScreen("Map");
      //               setTimeout(() => {
      //                 setMapActive(true);
      //               }, 850);
      //             }} style={style.actionBarButton}>
      //               <Text>{t("button.showMap")}</Text>
      //             </Button>
      //           }
      //         </View>
      //         <MetaData title={t("date")} data={formatISO(fromUnixTime(transaction.date.toNumber()))} />
      //         {transaction.note && <MetaData title={t("note")} data={transaction.note} />}
      //         {transaction.website && <MetaData title={t("website")} data={transaction.website} url={"https://" + transaction.website} />}
      //         {transaction.type !== "NORMAL" && <MetaData title={t("type")} data={transaction.type} />}
      //         {(transaction.type === "LNURL" && transaction.lnurlPayResponse && transaction.lnurlPayResponse.successAction) && <LNURLMetaData transaction={transaction} />}
      //         {(transaction.nodeAliasCached && name === null) && <MetaData title={t("generic.nodeAlias", { ns: namespaces.common })} data={transaction.nodeAliasCached} />}
              // {direction === "send" && transaction.lightningAddress && <MetaDataLightningAddress title={t("generic.lightningAddress", { ns: namespaces.common })} data={transaction.lightningAddress} />}
              // {direction === "receive" && !transaction.tlvRecordName && transaction.payer && <MetaData title={t("payer")} data={transaction.payer} />}
              // {direction === "receive" && transaction.tlvRecordName && <MetaData title={t("payer")} data={transaction.tlvRecordName} />}
              // {(direction === "send" && name) && <MetaData title={t("recipient")} data={name} />}
      //         {(description !== null && description.length > 0) && <MetaData title={t("generic.description", { ns: namespaces.common })} data={description} />}
      //         <MetaData title={t("generic.amount", { ns: namespaces.common })} data={formatBitcoin(transactionValue, bitcoinUnit)} />
      //         {transaction.valueFiat != null && transaction.valueFiatCurrency && <MetaData title={t("amountInFiatTimeOfPayment")} data={`${transaction.valueFiat.toFixed(2)} ${transaction.valueFiatCurrency}`} />}
      //         {transaction.fee !== null && transaction.fee !== undefined && <MetaData title={t("generic.fee", { ns: namespaces.common })} data={transaction.fee.toString() + " Satoshi"} />}
      //         {transaction.hops && transaction.hops.length > 0 && <MetaData title={t("numberOfHops")} data={transaction.hops.length.toString()} />}
      //         {direction === "send" && <MetaData title={t("remotePubkey")} data={transaction.remotePubkey} />}
      //         <MetaData title={t("paymentHash")} data={transaction.rHash}/>
      //         {transaction.status === "SETTLED" && transaction.preimage && <MetaData title={t("preimage")} data={bytesToHexString(transaction.preimage)}/>}
      //         <MetaData title={t("status")} data={capitalize(transaction.status)} />
      //         {transaction.status === "OPEN" && transaction.type !== "LNURL" &&
      //           <>
      //             <View style={{ width: "100%", alignItems: "center", justifyContent: "center" }}>
      //               <QrCode size={smallScreen ? 220 : 280} data={transaction.paymentRequest.toUpperCase()} onPress={onQrPress} border={25} />
      //             </View>
      //             <CopyAddress text={transaction.paymentRequest} onPress={onPaymentRequestTextPress} />
      //           </>
      //         }
      //       </ScrollView>
      //     </CardItem>
      //   </Card>
      // </Blurmodal>
      <Container style={{justifyContent: 'space-between', paddingRight: 15, paddingLeft: 15}}>
        <SafeAreaView style={{flexDirection: 'row', alignContent: 'center', justifyContent: 'space-between'}}>
          <Text style={{fontFamily: 'Sora-Regular', fontSize: 22}}>Transaction</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Overview")}>
            <AnimatedIcon type={'Feather'} name="x"/>
          </TouchableOpacity>
        </SafeAreaView>
        <SafeAreaView style={{flex: 2}}>
          <Text style={{textAlign: 'center', fontFamily: 'Sora-Regular', fontSize: 48}}>
            {formatBitcoin(transactionValue, bitcoinUnit)}
          </Text>
          {/* {transaction.status === "OPEN" &&
                  <Button small danger onPress={onPressCancelInvoice} style={style.actionBarButton}>
                    <Text>{t("button.cancelInvoice")}</Text>
                  </Button>
                } */}
          {transaction.status === "OPEN" &&
            <TouchableOpacity onPress={onPressCancelInvoice}>
              <Text style={{marginTop: 12, textAlign: 'center', fontFamily: 'Sora-Regular', fontSize: 16, color: 'red'}}>
                Cancel Invoice
              </Text>
            </TouchableOpacity>
          }
        </SafeAreaView>
        <SafeAreaView style={{flex: 10}}>
          <View style={style.metadata}>
            <Text style={style.title}>Date</Text>
            <Text style={style.subtitle}>{formatISO(fromUnixTime(transaction.date.toNumber()))}</Text>
          </View>
          {/*  {transaction.valueFiat != null && transaction.valueFiatCurrency && <MetaData title={t("amountInFiatTimeOfPayment")} data={`${transaction.valueFiat.toFixed(2)} ${transaction.valueFiatCurrency}`} />} */}
          {transaction.valueFiat != null && transaction.valueFiatCurrency && 
            <View style={style.metadata}>
              <Text style={style.title}>Amount in Fiat</Text>
              <Text style={style.subtitle}>{transaction.valueFiat.toFixed(2)}</Text>
            </View>
          }
          {transaction.fee !== null && transaction.fee !== undefined && 
            <View style={style.metadata}>
              <Text style={style.title}>Fee</Text>
              <Text style={style.subtitle}>{transaction.fee + " Satoshi"}</Text>
            </View>
          }
          <View style={style.metadata}>
            <Text style={style.title}>Status</Text>
            <Text style={style.subtitle}>{transaction.status}</Text>
          </View>
          <View style={style.metadata}>
            <Text style={style.title}>Hash</Text>
            <Text style={{fontFamily: 'Sora-ExtraLight', maxWidth: 200, fontSize: 12}}>{transaction.rHash}</Text>
          </View>
          <View style={style.metadata}>
            <Text style={style.title}>Preimage</Text>
            {transaction.status === "SETTLED" && transaction.preimage && <Text style={{fontFamily: 'Sora-ExtraLight', maxWidth: 200, fontSize: 12}}>{bytesToHexString(transaction.preimage)}</Text>}
          </View>
          {transaction.note == null &&
            <View style={style.metadata}>
              <Text style={style.title}>Note</Text>
              <Text style={style.subtitle}>No Description</Text>
            </View>
          }
          {transaction.note != null &&
            <View style={style.metadata}>
              <Text style={style.title}>Note</Text>
              <Text style={style.subtitle}>{transaction.note}</Text>
            </View>
          }
        </SafeAreaView>
        <SafeAreaView style={{alignContent: 'center', alignItems: 'center'}}>
          <TouchableOpacity style={{alignItems: 'center', borderRadius: 5, padding: 10, width: '95%', backgroundColor: 'white'}} onPress={onPressSetNote}>
            <Text style={{fontFamily: 'Sora-ExtraLight', color: 'black', textAlign: 'center', fontSize: 14}}>{"Set Note".toUpperCase()}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Container>
    );
  }
};


interface IWebLNMetaDataProps {
  transaction: ITransaction;
}
function LNURLMetaData({ transaction }: IWebLNMetaDataProps) {
  const t = useTranslation(namespaces.transactionDetails).t;
  let secretMessage: string | null = null;

  if (transaction.lnurlPayResponse?.successAction?.tag === "aes") {
    secretMessage = decryptLNURLPayAesTagMessage(
      transaction.preimage,
      transaction.lnurlPayResponse.successAction.iv,
      transaction.lnurlPayResponse.successAction.ciphertext,
    );
  }

  return (
    <>
      {transaction.lnurlPayResponse?.successAction?.tag === "message" &&
        <MetaData title={`${t("messageFromWebsite")} ${transaction.website}`} data={transaction.lnurlPayResponse.successAction.message} />
      }
      {transaction.lnurlPayResponse?.successAction?.tag === "url" &&
        <>
          <MetaData title={`${t("messageFromWebsite")} ${transaction.website}`} data={transaction.lnurlPayResponse.successAction.description} />
          <MetaData title={`${t("urlReceivedFromWebsite")} ${transaction.website}`} data={transaction.lnurlPayResponse.successAction.url} url={transaction.lnurlPayResponse.successAction.url} />
        </>
      }
      {transaction.lnurlPayResponse?.successAction?.tag === "aes" &&
        <>
          <MetaData title={`${t("messageFromWebsite")} ${transaction.website}`} data={transaction.lnurlPayResponse.successAction.description} />
          <MetaData title={`${t("secretMessage")}`} data={secretMessage!} />
        </>
      }
    </>
  );
}

const style = StyleSheet.create({
  card: {
    padding: 5,
    minHeight: PLATFORM !== "web" ? "50%" : undefined,
    maxHeight: PLATFORM !== "web" ? "85%" : undefined,
    overflow: "hidden",
  },
  header: {
    fontFamily: 'Sora-Regular'
  },
  detailText: {
    fontFamily: 'Sora-ExtraLight',
    marginBottom: 7,
    ...Platform.select({
      web: {
        wordBreak: "break-all"
      },
    }),
  },
  qrText: {
    marginBottom: 7,
    paddingTop: 4,
    paddingLeft: 18,
    paddingRight: 18,
  },
  actionBarButton: {
    margin: 7,
    borderRadius: 5,
    backgroundColor: 'white'
  },
  metadata: {
    marginBottom: 32, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center'
  },
  title: {
    fontFamily: 'Sora-Regular', 
    fontSize: 22
  },
  subtitle: {
    fontFamily: 'Sora-ExtraLight', 
    fontSize: 18
  }
});
