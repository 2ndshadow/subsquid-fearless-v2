import { FeesPaid, HistoryElement, Transfer } from '../generated/model';
import { Balances } from '../types'
import {
  DatabaseManager,
  EventContext,
  StoreContext,
  SubstrateBlock,
  SubstrateEvent,
  SubstrateExtrinsic,
} from "@subsquid/hydra-common";
import {
  blockNumber,
  eventId,
  timestamp,
} from "./helpers/common";
import { getOrCreate } from "./helpers/helpers";

export async function handleTransfer({
  store,
  event,
  block,
  extrinsic,
}: EventContext & StoreContext): Promise<void> {
    const [from, to, value] = new Balances.TransferEvent(event).params

  const elementFrom = await getOrCreate(
    store,
    HistoryElement,
    eventId(event) + `-from`
  );
 elementFrom.address = from.toString();
await populateTransfer(elementFrom, event, block, extrinsic, store);

  const elementTo = await getOrCreate(
    store,
    HistoryElement,
    eventId(event) + `-to`
  );
  elementTo.address = to.toString();
  await populateTransfer(elementTo, event,block, extrinsic,store);
}

export async function handleTransferKeepAlive({
  store,
  event,
  block,
  extrinsic,
}: EventContext & StoreContext): Promise<void> {
  await handleTransfer({ store, event, block, extrinsic });
}

async function populateTransfer(
  element: HistoryElement,
  event: SubstrateEvent,
  block : SubstrateBlock,
  extrinsic : SubstrateExtrinsic | undefined,
  store: DatabaseManager
): Promise<void> {
  element.timestamp = timestamp(block);
  element.blockNumber = blockNumber(event);
  if (extrinsic !== undefined) {
    element.extrinsicHash = extrinsic.hash;
    element.extrinsicIdx = extrinsic.id;
  }
  const [from, to, value] = new Balances.TransferEvent(event).params
  let transfer = await store.get(Transfer, {
    where: { extrinisicIdx: extrinsic?.id  },
  })
  if (transfer == null) {
    transfer = new Transfer()
  }

  if(extrinsic?.id == undefined){
    console.error(`extrinisic id undefined for transfer with event id = ${event.id}.Skipping it `)
    return
  }
  const feesPaid = await getOrCreate(
    store,
    FeesPaid,
    extrinsic.id
  ); 
  feesPaid.fee = feesPaid.fee|| 0n;
  feesPaid.blockProducerAddress = feesPaid.blockProducerAddress || ''
  await store.save(feesPaid);
  transfer.amount = value.toString();
  transfer.from=from.toString();
  transfer.to=to.toString();
  transfer.fee=feesPaid;
  transfer.extrinisicIdx=extrinsic?.id;
  transfer.eventIdx=event.id;
  transfer.success=true;
  transfer.id=event.id
  await store.save(transfer);
  element.transfer = transfer
  await store.save(element);
}
