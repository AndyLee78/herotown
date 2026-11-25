import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MARKET_MATERIALS, POTION_IDS, buyQuote, gearValue, marketRules, merchantHere, potionValue, pressureOf, seasonDeal, sellQuote, type GameAction, type GameState, type MerchantOffer } from '../../core'
import { gearMods } from '../../core/gear'
import { Chip, Res, itemLabel, useNow, waitLabel } from './kit'

const tabs = ['materials', 'sell', 'merchant'] as const
type Sale = Extract<GameAction, { type: 'sellGear' | 'sellPotion' }>

export function Market({ save, onAction }: { save: GameState; onAction: (action: GameAction) => void }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<typeof tabs[number]>('materials')
  const [quantity, setQuantity] = useState(1)
  const [sale, setSale] = useState<{ action: Sale; name: string } | null>(null)
  const merchant = merchantHere(save)
  const now = useNow(tab === 'merchant' && merchant != null)
  const level = save.buildings.market
  if (level < 1) return <p className="banner">{t('result.noMarket')}</p>
  const { cheap, wanted } = seasonDeal(save)
  const discount = Math.round(marketRules.deal.discount * 100)
  const demand = Math.round(marketRules.deal.demand * 100)
  return (
    <div className="column">
      <p className="banner">{t('market.deal', { cheap: t(`material.${cheap}`), wanted: t(`material.${wanted}`), discount, demand })}</p>
      <div className="tabs" role="tablist" aria-label={t('screen.market')}>
        {tabs.map((entry) => <button key={entry} type="button" role="tab" aria-selected={tab === entry} className={tab === entry ? 'active' : ''} onClick={() => {
          setTab(entry)
          setSale(null)
        }}>{t(`market.${entry}`)}</button>)}
      </div>
      <div className="column" role="tabpanel" aria-label={t(`market.${tab}`)}>
        {tab !== 'merchant' ? <label className="field">
          {t('market.quantity')}
          <select value={quantity} onChange={(event) => { setQuantity(Number(event.target.value)); setSale(null) }}>
            {[1, 10, 50].map((count) => <option value={count} key={count}>{count}</option>)}
          </select>
        </label> : null}
        {tab === 'materials' ? <div className="market-grid">{MARKET_MATERIALS.map((material) => {
          const buy = buyQuote(save, material, quantity)
          const sell = sellQuote(save, material, quantity)
          const pressure = Math.round(pressureOf(save, material) * 100)
          return <article className="card" key={material}>
            <div className="line"><strong>{t(`material.${material}`)}</strong><Res kind={material} amount={save.materials[material]} /></div>
            <div className="chips">
              <Chip tone={pressure > 0 ? 'warn' : pressure < 0 ? 'good' : undefined}>{t('market.pressure', { value: pressure > 0 ? `↑ ${pressure}` : pressure < 0 ? `↓ ${-pressure}` : '0' })}</Chip>
              {material === cheap ? <Chip tone="good">{t('market.discount', { percent: discount })}</Chip> : null}
              {material === wanted ? <Chip tone="warn">{t('market.demand', { percent: demand })}</Chip> : null}
            </div>
            <p className="muted">{t('market.unitPrices', { buy: buyQuote(save, material, 1), sell: sellQuote(save, material, 1) })}</p>
            <div className="row">
              <button type="button" className="btn primary small" disabled={save.gold < buy} onClick={() => onAction({ type: 'trade', material, amount: quantity })}>{t('market.buyGold', { gold: buy })}</button>
              <button type="button" className="btn small" disabled={save.materials[material] < quantity} onClick={() => onAction({ type: 'trade', material, amount: -quantity })}>{t('market.sellGold', { gold: sell })}</button>
            </div>
          </article>
        })}</div> : null}
        {tab === 'sell' ? <>
          {sale ? <div className="banner" role="status">
            <span>{t('market.confirm', { name: sale.name })}</span>
            <button type="button" className="btn danger small" onClick={() => { onAction(sale.action); setSale(null) }}>{t('market.confirmSale')}</button>
            <button type="button" className="btn small" onClick={() => setSale(null)}>{t('ui.cancel')}</button>
          </div> : null}
          <h3 className="section-title">{t('label.stash')}</h3>
          {save.stash.length === 0 ? <p className="muted">{t('hint.emptyStash')}</p> : null}
          <ul className="plain">{save.stash.map((gear) => {
            const name = itemLabel(t, gear, 'warrior')
            const value = gearValue(gear)
            return <li key={gear.id} className="line">
              <span>{name}</span>
              <button type="button" className="btn small" disabled={value <= 0} onClick={() => setSale({ action: { type: 'sellGear', gearId: gear.id }, name })}>{t('market.sellGold', { gold: value })}</button>
            </li>
          })}</ul>
          <h3 className="section-title">{t('alchemy.stock')}</h3>
          <ul className="plain">{POTION_IDS.map((potionId) => {
            const name = t(`potion.${potionId}`)
            const stock = save.potions[potionId] ?? 0
            const unit = potionValue(potionId)
            // Sells what there is when the chosen amount is more than the stock.
            const count = Math.min(stock, quantity)
            return <li key={potionId} className="line">
              <span>{name} <Chip>{stock}</Chip> <span className="muted">{t('market.unitSale', { gold: unit })}</span></span>
              <button type="button" className="btn small" disabled={count <= 0 || unit <= 0} onClick={() => setSale({ action: { type: 'sellPotion', potionId, count }, name: t('market.bundle', { name, count }) })}>{t('market.sellGold', { gold: count * unit })}</button>
            </li>
          })}</ul>
        </> : null}
        {tab === 'merchant' ? merchant ? <>
          <p className="banner">{t('market.leaves', { time: waitLabel(merchant.leaveAt - now) })}</p>
          <div className="market-grid">{merchant.offers.map((offer) => <Offer key={offer.id} offer={offer} gold={save.gold} onBuy={() => onAction({ type: 'buyOffer', offerId: offer.id })} />)}</div>
        </> : <p className="muted">{t('market.absent')}</p> : null}
      </div>
    </div>
  )
}

function Offer({ offer, gold, onBuy }: { offer: MerchantOffer; gold: number; onBuy: () => void }) {
  const { t } = useTranslation()
  const stats = offer.kind === 'gear' ? gearMods(offer.gear) : undefined
  const name = offer.kind === 'gear' ? itemLabel(t, offer.gear, 'warrior') : offer.kind === 'material'
    ? t('market.bundle', { name: t(`material.${offer.material}`), count: offer.amount })
    : t('market.bundle', { name: t(`potion.${offer.potionId}`), count: offer.count })
  return (
    <article className="card column">
      <strong>{name}</strong>
      {stats ? <span className="muted">{t('smith.stats', stats)}</span> : null}
      <div className="row">
        <Res kind="gold" amount={offer.price} />
        <button type="button" className="btn primary small" disabled={offer.sold || gold < offer.price} onClick={onBuy}>{t(offer.sold ? 'market.sold' : 'market.buy')}</button>
      </div>
    </article>
  )
}
