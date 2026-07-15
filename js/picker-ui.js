(function () {
  'use strict';

  var SELECTORS = {
    nativeOptionList: '.ec-product-button[ec-dev-id^="product_option_id"], .ec-product-button, select[id^="product_option_id"], select[name^="option"]',
    nativeOptionItem: 'li[option_value], option[value]',
    selectedRoot: '#totalProducts',
    selectedCode: '.option_box_id',
  };
  var selecting = false;

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[char];
    });
  }

  function getPackName(value) {
    var text = normalizeText(value);
    var packMatch = text.match(/(\d+\s*개입)/);
    if (packMatch) return normalizeText(packMatch[1]);

    return text
      .replace(/\s*\([^)]*\)\s*$/, '')
      .replace(/\s+\d[\d,]*\s*원.*$/, '')
      .replace(/_[0-9]+$/, '');
  }

  function getOptionTitle(item) {
    return normalizeText(item.getAttribute('title') || item.textContent);
  }

  function getOptionCode(item) {
    return item.getAttribute('option_value') || item.value || item.getAttribute('value');
  }

  function getOptionImage(item) {
    var image = item.querySelector ? item.querySelector('img') : null;
    return image ? image.getAttribute('src') || image.getAttribute('data-src') || '' : '';
  }

  function getOptionSummary(item) {
    return item.getAttribute('data-summary') ||
      item.getAttribute('data-option-summary') ||
      item.getAttribute('summary') ||
      '';
  }

  function isPlaceholderOption(item, code, title) {
    return item.tagName === 'OPTION' && (
      !code ||
      code === '*' ||
      code === '**' ||
      /^\[.*\]$/.test(title) ||
      title.indexOf('옵션 선택') > -1 ||
      title.indexOf('필수') > -1
    );
  }

  function parseOptionPricing(value) {
    var text = normalizeText(value);
    var packMatch = text.match(/(\d+\s*개입)/);
    var priceMatch = text.match(/(\d[\d,]*\s*원)/);
    var discountMatch = text.match(/(\d+\s*%\s*할인)/);

    return {
      packName: packMatch ? normalizeText(packMatch[1]) : getPackName(text),
      priceText: priceMatch ? normalizeText(priceMatch[1]) : '',
      discountText: discountMatch ? normalizeText(discountMatch[1]) : '',
    };
  }

  function findNativeOptionList() {
    var lists = Array.prototype.slice.call(document.querySelectorAll(SELECTORS.nativeOptionList));
    return lists.find(function (list) {
      return list.querySelector(SELECTORS.nativeOptionItem);
    }) || null;
  }

  function getNativeOptions(nativeList) {
    return Array.prototype.map.call(
      nativeList.querySelectorAll(SELECTORS.nativeOptionItem),
      function (item) {
        var title = getOptionTitle(item);
        var code = getOptionCode(item);
        var pricing = parseOptionPricing(title);

        return {
          code: code,
          title: title,
          image: getOptionImage(item),
          summary: normalizeText(getOptionSummary(item)),
          packName: pricing.packName,
          pricing: pricing,
          element: item,
          trigger: item.querySelector('a, button') || item,
          disabled: item.disabled ||
            item.classList.contains('ec-product-soldout') ||
            item.classList.contains('disabled') ||
            item.getAttribute('aria-disabled') === 'true',
          placeholder: isPlaceholderOption(item, code, title),
        };
      }
    ).filter(function (option) {
      return option.code && option.title && !option.placeholder;
    });
  }

  function getSelectedCodes() {
    return new Set(Array.prototype.map.call(
      document.querySelectorAll(SELECTORS.selectedRoot + ' ' + SELECTORS.selectedCode),
      function (input) {
        return input.value;
      }
    ).filter(Boolean));
  }

  function getSelectedRowByCode(code) {
    var input = document.querySelector(SELECTORS.selectedRoot + ' ' + SELECTORS.selectedCode + '[value="' + code + '"]');
    return input ? input.closest('tr.option_product, tr.add_product') : null;
  }

  function getSelectedQuantity(code) {
    var row = getSelectedRowByCode(code);
    var input = row ? row.querySelector('.quantity_opt, input[name^="quantity"]') : null;
    var quantity = input ? parseInt(input.value, 10) : 0;
    return Number.isFinite(quantity) ? quantity : 0;
  }

  function parseCurrency(value) {
    var number = String(value || '').replace(/[^\d]/g, '');
    return number ? parseInt(number, 10) : 0;
  }

  function formatCurrency(value) {
    return String(Math.max(0, value || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원';
  }

  function getSelectedCount() {
    var selectedCodes = document.querySelectorAll(SELECTORS.selectedRoot + ' ' + SELECTORS.selectedCode);
    if (selectedCodes.length) return selectedCodes.length;

    return document.querySelectorAll(
      SELECTORS.selectedRoot + ' tbody tr.option_product, ' +
      SELECTORS.selectedRoot + ' tbody tr.add_product'
    ).length;
  }

  function getTotalPrice() {
    var totalNode = document.querySelector('.totalPrice .total em') ||
      document.querySelector('.totalPrice em') ||
      document.querySelector('.totalPrice');
    return parseCurrency(totalNode ? totalNode.textContent : '');
  }

  function refreshSummary() {
    var summary = document.querySelector('.ignis-sticky-summary');
    if (!summary) return;

    var totalPrice = getTotalPrice();
    var selectedCount = getSelectedCount();
    var countNode = summary.querySelector('[data-ignis-total-count]');
    var priceNode = summary.querySelector('[data-ignis-total-price]');
    var shipping = summary.querySelector('.ignis-free-shipping');

    if (countNode) countNode.textContent = String(selectedCount);
    if (priceNode) priceNode.textContent = formatCurrency(totalPrice);

    if (shipping) {
      var threshold = parseCurrency(shipping.getAttribute('data-free-shipping-threshold')) || 40000;
      var remaining = Math.max(0, threshold - totalPrice);
      var progress = Math.max(0, Math.min(100, Math.round((totalPrice / threshold) * 100)));
      var bar = shipping.querySelector('.ignis-free-shipping-bar');
      var label = shipping.querySelector('p');

      if (bar) bar.style.width = progress + '%';
      if (label) {
        label.innerHTML = remaining > 0
          ? '<strong>' + formatCurrency(remaining) + '</strong> 더 담으면 <strong>무료배송</strong>'
          : '<strong>무료배송</strong> 조건을 달성했어요';
      }
    }
  }

  function getPackState(packName, options, selectedCodes) {
    var packOptions = options.filter(function (option) {
      return option.packName === packName;
    });
    var configMaximum = Number(arguments.length > 3 ? arguments[3] : packOptions.length);
    if (!Number.isFinite(configMaximum) || configMaximum < 0) configMaximum = packOptions.length;
    var selected = packOptions.filter(function (option) {
      return selectedCodes.has(option.code);
    }).length;
    var available = packOptions.filter(function (option) {
      return !selectedCodes.has(option.code) && !option.disabled;
    }).length;
    var maximum = Math.min(configMaximum, packOptions.length);

    return {
      selected: selected,
      maximum: maximum,
      remaining: Math.min(Math.max(0, maximum - selected), available),
    };
  }

  function getNextOption(packName, options, selectedCodes) {
    return options.find(function (option) {
      return option.packName === packName && !selectedCodes.has(option.code) && !option.disabled;
    }) || null;
  }

  function selectNativeOption(option) {
    if (option.element.tagName === 'OPTION') {
      option.element.parentNode.value = option.code;
      option.element.parentNode.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    option.trigger.click();
  }

  function increaseOption(option) {
    var row = getSelectedRowByCode(option.code);
    var up = row ? row.querySelector('.eProductQuantityUpClass, .up') : null;

    if (up) {
      up.click();
      return;
    }

    selectNativeOption(option);
  }

  function decreaseOption(option) {
    var row = getSelectedRowByCode(option.code);
    if (!row) return;

    var quantity = getSelectedQuantity(option.code);
    var target = quantity > 1
      ? row.querySelector('.eProductQuantityDownClass, .down')
      : row.querySelector('.option_box_del, .delete');

    if (target) target.click();
  }

  function getConfigByPack(config) {
    return config.reduce(function (acc, item) {
      acc[item.packName] = item;
      return acc;
    }, {});
  }

  function getUniquePackNames(options) {
    return options.reduce(function (acc, option) {
      if (option.packName && acc.indexOf(option.packName) === -1) acc.push(option.packName);
      return acc;
    }, []);
  }

  function resolvePickerItem(packName, configItem, options) {
    var nativeOption = options.find(function (option) {
      return option.packName === packName;
    });
    var pricing = nativeOption ? nativeOption.pricing : {};
    var nativeTitle = nativeOption ? getPackName(nativeOption.title) : '';

    return {
      packName: packName,
      displayName: nativeTitle || configItem.displayName || packName,
      maxSelectable: configItem.maxSelectable,
      priceText: pricing.priceText || configItem.priceText || '',
      discountText: pricing.discountText || configItem.discountText || '',
      description: configItem.description || '',
      badge: configItem.badge || '',
      recommended: Boolean(configItem.recommended),
    };
  }

  function resolvePickerItems(config, options) {
    var configByPack = getConfigByPack(config);
    var packNames = getUniquePackNames(options);

    return packNames.map(function (packName) {
      return resolvePickerItem(packName, configByPack[packName] || { packName: packName }, options);
    });
  }

  function resolveCustomItems(options) {
    return options.map(function (option, index) {
      return {
        name: option.title,
        summary: option.summary,
        image: option.image,
        option: option,
        index: index,
      };
    }).filter(function (item) {
      return item.option && item.name;
    });
  }

  function hasCustomOptionData(items) {
    return items.some(function (item) {
      return Boolean(item.image || item.summary);
    });
  }

  function renderCustomOptions(mount, items) {
    mount.innerHTML = [
      '<div class="cafe24-picker-panel">',
      '<button type="button" class="cafe24-picker-header" aria-expanded="true">옵션 선택 (필수)</button>',
      '<div class="custom-option-list-scroll">',
      '<ul class="custom-option-list">',
      items.map(function (item) {
        var productClass = item.image ? 'custom-option-product has-image' : 'custom-option-product no-image';
        return [
          '<li class="custom-option-item" data-index="', item.index, '" data-code="', escapeHtml(item.option.code), '">',
          '<div class="', productClass, '">',
          item.image ? '<div class="custom-option-img"><img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.name) + '" loading="lazy"></div>' : '',
          '<div class="custom-option-info">',
          '<p class="custom-option-name">', escapeHtml(item.name), '</p>',
          item.summary ? '<p class="custom-option-summary">' + escapeHtml(item.summary) + '</p>' : '',
          '</div>',
          '</div>',
          '<div class="custom-option-qty">',
          '<button type="button" class="custom-qty-minus" data-index="', index, '" aria-label="수량 감소">-</button>',
          '<input type="number" class="custom-qty-input" value="0" min="0" readonly="readonly" tabindex="-1" aria-readonly="true" inputmode="none">',
          '<button type="button" class="custom-qty-plus" data-index="', index, '" aria-label="수량 증가">+</button>',
          '</div>',
          '</li>',
        ].join('');
      }).join(''),
      '</ul>',
      '</div>',
      '</div>',
      '<p class="cafe24-picker-message" role="status" aria-live="polite"></p>',
    ].join('');
  }

  function renderCards(mount, config) {
    mount.innerHTML = [
      '<div class="cafe24-picker-panel">',
      '<button type="button" class="cafe24-picker-header" aria-expanded="true">옵션 선택 (필수)</button>',
      '<ul class="cafe24-picker-list">',
      config.map(function (item) {
        return [
          '<li>',
          '<button type="button" class="cafe24-picker-row',
          item.recommended ? ' is-recommended' : '',
          '" data-pack="', escapeHtml(item.packName), '" aria-pressed="false">',
          '<span class="cafe24-picker-radio" aria-hidden="true"></span>',
          '<strong class="cafe24-picker-name">', escapeHtml(item.displayName), '</strong>',
          '<span class="cafe24-picker-meta">',
          '<span class="cafe24-picker-price-line">',
          item.priceText ? '<span class="cafe24-picker-price">' + escapeHtml(item.priceText) + '</span>' : '',
          item.discountText ? '<span class="cafe24-picker-discount">(' + escapeHtml(item.discountText) + ')</span>' : '',
          item.recommended ? '<span class="cafe24-picker-badge">' + escapeHtml(item.badge) + '</span>' : '',
          '</span>',
          '<span class="cafe24-picker-description">', escapeHtml(item.description), '</span>',
          '<span class="cafe24-picker-count"></span>',
          '</span>',
          '</button>',
          '</li>',
        ].join('');
      }).join(''),
      '</ul>',
      '</div>',
      '<p class="cafe24-picker-message" role="status" aria-live="polite"></p>',
    ].join('');
  }

  function setMessage(mount, message) {
    var messageNode = mount.querySelector('.cafe24-picker-message');
    if (messageNode) messageNode.textContent = message || '';
  }

  function refresh(mount, nativeList) {
    var options = getNativeOptions(nativeList);
    var selectedCodes = getSelectedCodes();

    Array.prototype.forEach.call(mount.querySelectorAll('.custom-option-item'), function (item) {
      var input = item.querySelector('.custom-qty-input');
      var code = item.getAttribute('data-code');
      var quantity = getSelectedQuantity(code);

      item.classList.toggle('is-selected', quantity > 0);
      if (input) input.value = String(quantity);
    });

    Array.prototype.forEach.call(mount.querySelectorAll('.cafe24-picker-row'), function (card) {
      var configItem = getConfigByPack(window.CAFE24_PICKER_CONFIG || [])[card.dataset.pack] || {};
      var state = getPackState(card.dataset.pack, options, selectedCodes, configItem.maxSelectable);
      var isSelected = state.selected > 0;
      var isDisabled = state.maximum === 0 || state.remaining === 0;
      var countNode = card.querySelector('.cafe24-picker-count');

      card.classList.toggle('is-selected', isSelected);
      card.classList.toggle('is-disabled', isDisabled);
      card.disabled = isDisabled;
      card.setAttribute('aria-pressed', String(isSelected));
      countNode.textContent = state.maximum > 0
        ? state.selected + ' / ' + state.maximum + ' 선택'
        : '옵션 없음';
    });

    refreshSummary();
  }

  function syncCustomQuantities(mount) {
    Array.prototype.forEach.call(mount.querySelectorAll('.custom-option-item'), function (item) {
      var input = item.querySelector('.custom-qty-input');
      var code = item.getAttribute('data-code');
      if (input) input.value = String(getSelectedQuantity(code));
    });
  }

  function togglePickerPanel(mount) {
    var panel = mount.querySelector('.cafe24-picker-panel');
    var header = mount.querySelector('.cafe24-picker-header');
    if (!panel || !header) return;

    var collapsed = !panel.classList.contains('is-collapsed');
    panel.classList.toggle('is-collapsed', collapsed);
    header.setAttribute('aria-expanded', String(!collapsed));
  }

  function init() {
    var config = window.CAFE24_PICKER_CONFIG;
    var nativeList = findNativeOptionList();
    var selectedRoot = document.querySelector(SELECTORS.selectedRoot);
    var nativeOptions = nativeList ? getNativeOptions(nativeList) : [];

    if (!Array.isArray(config) || !config.length || !nativeList || !selectedRoot || !nativeOptions.length) return;
    if (document.getElementById('cafe24-option-picker')) return;

    var optionTable = nativeList.closest('table');
    if (!optionTable) return;

    var mount = document.createElement('section');
    mount.id = 'cafe24-option-picker';
    mount.setAttribute('aria-label', '골라담기 옵션');
    optionTable.parentNode.insertBefore(mount, optionTable);
    nativeList.classList.add('cafe24-picker-native-hidden');

    var customItems = resolveCustomItems(nativeOptions);
    if (customItems.length && hasCustomOptionData(customItems)) {
      renderCustomOptions(mount, customItems);
    } else {
      renderCards(mount, resolvePickerItems(config, nativeOptions));
    }
    refresh(mount, nativeList);

    mount.addEventListener('click', function (event) {
      if (event.target.closest('.cafe24-picker-header')) {
        togglePickerPanel(mount);
        return;
      }

      var customButton = event.target.closest('.custom-qty-minus, .custom-qty-plus');
      if (customButton && !selecting) {
        var customItem = customButton.closest('.custom-option-item');
        var customIndex = customItem ? parseInt(customItem.getAttribute('data-index'), 10) : -1;
        var customOption = nativeOptions[customIndex];

        if (!customOption || customOption.disabled) return;

        selecting = true;
        setMessage(mount, '');

        if (customButton.classList.contains('custom-qty-plus')) {
          increaseOption(customOption);
        } else {
          decreaseOption(customOption);
        }

        window.setTimeout(function () {
          selecting = false;
          syncCustomQuantities(mount);
          refresh(mount, nativeList);
        }, 150);
        return;
      }

      var card = event.target.closest('.cafe24-picker-row');
      if (!card || card.disabled || selecting) return;

      var option = getNextOption(card.dataset.pack, getNativeOptions(nativeList), getSelectedCodes());
      if (!option) {
        setMessage(mount, card.dataset.pack + '은 더 이상 추가할 수 없습니다.');
        refresh(mount, nativeList);
        return;
      }

      selecting = true;
      setMessage(mount, '');
      selectNativeOption(option);

      window.setTimeout(function () {
        selecting = false;
        refresh(mount, nativeList);
      }, 150);
    });

    new MutationObserver(function () {
      refresh(mount, nativeList);
    }).observe(selectedRoot, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    refreshSummary();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
