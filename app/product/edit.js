import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProducts } from '../../lib/useProducts';
import { useToast } from '../../lib/toast';
import { Editor, Field, Chip, EmojiPicker, Empty } from '../../lib/ui';
import { requiredText } from '../../lib/formValidation';
import { useEntityForm } from '../../lib/useEntityForm';
import { CATEGORIES } from '../../lib/groceryCatalog';
import { colors, type, space } from '../../lib/theme';
import { t } from '../../lib/i18n';

// Producteditor (BOO-13): bewerk een huishoud-catalogusproduct — naam, schap, standaard-
// eenheid en een icoon (emoji). Schrijft naar de gedeelde `products`-rij, dus geldt
// huishouden-breed. Bereikbaar vanuit de Catalogus (tik op een product) en uit de
// "even aankleden?"-prompt nadat je een nieuw product toevoegt.

// Curated icoon-set: de schap-emoji's + een handvol veelvoorkomende producten. De huidige
// emoji van het product wordt zo nodig vooraan toegevoegd zodat 'ie altijd zichtbaar is.
const BASE_EMOJI = [
  '🥦', '🥕', '🍅', '🥔', '🧅', '🍎', '🍌', '🍓', '🥛', '🧀', '🥚', '🍞',
  '🥩', '🐟', '🍝', '🍚', '🥫', '🧂', '🍫', '🍪', '🧃', '☕', '🧴', '🧽', '🧻', '🐾',
];

export default function ProductEditScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { products, loading, updateProduct } = useProducts();
  const product = products.find((p) => p.id === id) ?? null;

  if (!product) {
    return (
      <Editor title={t('product.edit.title')} onClose={() => router.back()}>
        {loading ? null : <Empty illustration="groceries" title={t('product.notFound')} />}
      </Editor>
    );
  }
  // Pas als het product geladen is monteren we het formulier, zodat useEntityForm met de
  // juiste beginwaarden initialiseert (de hook leest initialValues alleen bij mount).
  return <ProductEditForm key={product.id} product={product} updateProduct={updateProduct} />;
}

function ProductEditForm({ product, updateProduct }) {
  const router = useRouter();
  const toast = useToast();
  const { values, setField, errors, busy, submit } = useEntityForm({
    name: product.name ?? '',
    category: product.category ?? null,
    unit: product.default_unit ?? '',
    emoji: product.emoji ?? null,
  });

  const dirty = (
    values.name !== (product.name ?? '')
    || (values.category ?? null) !== (product.category ?? null)
    || values.unit !== (product.default_unit ?? '')
    || (values.emoji ?? null) !== (product.emoji ?? null)
  );

  // De huidige emoji vooraan tonen als 'ie niet in de standaardset zit (geen dubbele).
  const emojiOptions = useMemo(() => (
    values.emoji && !BASE_EMOJI.includes(values.emoji) ? [values.emoji, ...BASE_EMOJI] : BASE_EMOJI
  ), [values.emoji]);

  const save = () => submit(
    [requiredText('name', t('product.error.name'))],
    async (vals) => {
      await updateProduct(product.id, {
        name: vals.name,
        category: vals.category,
        defaultUnit: vals.unit?.trim() || null,
        emoji: vals.emoji,
      });
      toast.show({ message: t('product.edit.saved', { name: vals.name.trim() }) });
      router.back();
    },
  );

  return (
    <Editor title={t('product.edit.title')} onClose={() => router.back()} onConfirm={save} busy={busy} dirty={dirty}>
      <Field
        label={t('product.edit.name')}
        value={values.name}
        onChangeText={(v) => setField('name', v)}
        error={errors.name}
        autoFocus={!values.name}
      />

      <Text style={[type.label, { marginTop: space.md, marginBottom: space.sm }]}>{t('product.edit.category')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c.key}
            label={`${c.emoji} ${c.label}`}
            active={values.category === c.key}
            onPress={() => setField('category', values.category === c.key ? null : c.key)}
          />
        ))}
      </View>

      <Field
        label={t('product.edit.unit')}
        value={values.unit}
        onChangeText={(v) => setField('unit', v)}
        placeholder={t('product.edit.unit.placeholder')}
        style={{ marginTop: space.md }}
      />

      <Text style={[type.label, { marginTop: space.md, marginBottom: space.sm }]}>{t('product.edit.emoji')}</Text>
      <Text style={[type.caption, { color: colors.inkSoft, marginBottom: space.sm }]}>{t('product.edit.emoji.hint')}</Text>
      <EmojiPicker
        options={emojiOptions}
        value={values.emoji}
        onChange={(e) => setField('emoji', values.emoji === e ? null : e)}
      />
    </Editor>
  );
}
