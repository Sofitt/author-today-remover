const dataTags = {
  banList: 'data-ban-list',
  listContainer: 'data-ban-list-container',
  listItem: 'data-ban-button-item',
  blockButton: 'data-ban-button',
  blockButtonIcon: 'data-ban-button-icon',
}
const styles = {
  button: {
    minWidth: '1em',
    minHeight: '1em',
    color: 'white',
    border: '1px solid black',
    position: 'relative',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  icon: {
    fontSize: '10px',
    width: '12px',
    height: '12px',
    pointerEvents: 'none',
    lineHeight: '12px',
  },
}

class Helper {
  bookBlockClassName = 'book-row'

  isObject(variable) {
    return (
      typeof variable === 'object' &&
      !Array.isArray(variable) &&
      variable !== null
    )
  }
  getRowNode(el) {
    if (!el.parentNode) {
      console.error(`Для элемента не найден родитель: ${el}`)
      return null
    }
    return el.classList.contains(this.bookBlockClassName)
      ? el
      : this.getRowNode(el.parentNode)
  }
  getNameStrArr(name) {
    if (typeof name !== 'string') {
      throw new Error('name должно быть строкой')
    }
    const nameArr = name.split(' ')
    if (nameArr.at(0) !== name) {
      // Полное имя в начале
      nameArr.unshift(name)
    }
    return nameArr
  }
  getNamesFromAuthorBlock(el) {
    // Блок имени автора может содержать соавторов.
    // Для простоты, все имена идут во вложенных массивах
    const nameEls = [...el.children].filter((child) => child.tagName === 'A')
    return nameEls.map((name) => this.getNameStrArr(name.textContent))
  }
}

class BanButton {
  #button
  helper = new Helper()
  containerEl
  mutate

  constructor(containerEl, mutateFunc) {
    this.containerEl = containerEl
    this.mutate = mutateFunc
  }

  clickOutside(e, close) {
    const onClose = () => {
      ;[...this.#button.children].forEach((child) => {
        if (close) {
          child.removeEventListener('click', this.clickOutside)
        }
        child[dataTags.blockButtonIcon] !== 'true' && child.remove()
      })
      return true
    }
    if (close || !this.containerEl.contains(e.target)) {
      return onClose()
    }
    return false
  }
  createSelectorEl(strArr) {
    if (!Array.isArray(strArr[0])) {
      throw new Error('Массив должен быть вложенным')
    }
    const list = document.createElement('div')
    Object.assign(list.style, {
      minWidth: '100px',
      maxHeight: '300px',
      overflowY: 'auto',
      backgroundColor: 'white',
      color: 'black',
      border: '1px solid black',
      position: 'absolute',
      top: '1em',
      left: '0',
      zIndex: 1,
      display: 'flex',
      flexFlow: 'column',
    })

    const createItemEl = (text) => {
      const item = document.createElement('button')
      Object.assign(item.style, {
        fontSize: '14px',
        color: 'black',
        cursor: 'pointer',
        padding: '8px 4px',
        border: '1px solid gray',
        minHeight: '34px',
        whiteSpace: 'nowrap',
      })
      item[dataTags.listItem] = 'true'

      const listenerManager = (object, action, type, handler) => {
        const map = {
          add: 'addEventListener',
          remove: 'removeEventListener',
        }
        object[map[action]](type, handler)
      }
      item.textContent = text
      const onClick = () => {
        this.mutate(text)
        if (this.clickOutside(item, true)) {
          listenerManager(item, 'remove', 'click', onClick)
        }
      }
      listenerManager(item, 'add', 'click', onClick)
      return item
    }

    strArr.forEach((arr) => {
      arr.forEach((str) => list.append(createItemEl(str)))
    })

    return list
  }
  setupSelection(nameEl) {
    this.#button.append(
      this.createSelectorEl(this.helper.getNamesFromAuthorBlock(nameEl)),
    )
  }
  create() {
    const button = document.createElement('button')
    Object.assign(button.style, {
      ...styles.button,
      // marginLeft: '8px',
    })
    button.title = 'Заблокировать по имени...'
    button[dataTags.blockButton] = 'true'

    const plus = document.createElement('span')
    plus.style.fontSize = '12px'
    plus.style.pointerEvents = 'none'
    plus.textContent = '🚫'
    plus[dataTags.blockButtonIcon] = 'true'
    button.append(plus)
    this.#button = button

    button.addEventListener('click', ({ target }) => {
      if (target[dataTags.listItem] === 'true') return
      const parent = target.parentNode

      if ([...parent.children].length < 2) {
        console.error('Элементы не найдены', target)
        return
      }
      this.setupSelection(parent)
    })
    window.addEventListener('click', this.clickOutside.bind(this))
    return button
  }
}

class AuthorRemover {
  href = 'https://author.today/work/genre'
  storageKey = 'extension-inject-ban-list'

  // Ключ может состоять из одного либо больше слов.
  // { 'aboba': timestamp } - все строки содержащие 'aboba'
  // { 'Константин Константинов': timestamp } - все строки содержащие 'Константин Константинов'
  defaultBanList = {}
  buttonEls = []

  helper = new Helper()

  get banList() {
    const storageList = localStorage.getItem(this.storageKey)
    const banList = storageList ? JSON.parse(storageList) : this.defaultBanList
    if (!this.helper.isObject(banList)) {
      throw new Error('localStorage banList is invalid')
    }
    return banList
  }
  set banList(list) {
    localStorage.setItem(this.storageKey, JSON.stringify(list))
    this.defaultBanList = list
    this._init(true)
  }
  get banKeys() {
    return Object.keys(this.banList).sort((a, b) => {
      return this.banList[b] - this.banList[a]
    })
  }

  removeFromBanList(str) {
    if (typeof str !== 'string') {
      throw new Error('Значение должно быть строкой')
    }
    if (!this.banList[str]) {
      throw new Error('Значения не существует')
    }
    const banList = { ...this.banList }
    delete banList[str]

    this.banList = banList
  }
  mutateBanList(newWord) {
    if (typeof newWord !== 'string') {
      throw new Error('Значение должно быть строкой')
    }

    const currentList = { ...this.banList }
    currentList[newWord] = new Date().getTime()
    this.banList = currentList
  }
  validateHref() {
    return window.location.href.startsWith(this.href)
  }

  injectBanButton(containerEl) {
    Object.assign(containerEl.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    })
    const el = new BanButton(
      containerEl,
      this.mutateBanList.bind(this),
    ).create()
    containerEl.append(el)
    return el
  }

  setupAuthorBan(update) {
    if (update) {
      if (this.buttonEls.length) {
        this.buttonEls.forEach((b) => {
          b.remove()
        })
        this.buttonEls = []
      }
    }

    const searchResultsBlock = document.querySelector('#search-results')
    const authorNames = searchResultsBlock.querySelectorAll('.book-author')

    if (!searchResultsBlock || !authorNames) {
      throw new Error('Что то пошло не так', [searchResultsBlock, authorNames])
    }

    const handleContainBanWord = (el, ban = true) => {
      const rowBlock = this.helper.getRowNode(el)
      if (rowBlock) {
        rowBlock.style.display = ban ? 'none' : ''
      }
    }

    authorNames.forEach((nameContainerEl) => {
      const nameStrArr = this.helper.getNamesFromAuthorBlock(nameContainerEl)
      const containsBanWord = nameStrArr.map((i) =>
        i.some((name) => {
          return Boolean(this.banList[name])
        }),
      )

      if (containsBanWord.includes(true)) {
        handleContainBanWord(nameContainerEl)
        return
      }
      handleContainBanWord(nameContainerEl, false)

      this.buttonEls.push(this.injectBanButton(nameContainerEl))
    })
  }
  setupUiBanList(update) {
    const searchResultsBlock = document.querySelector('#search-results')
    if (
      update &&
      searchResultsBlock.firstChild[dataTags.listContainer] === 'true'
    ) {
      searchResultsBlock.firstChild.remove()
    }

    const createBanListItem = (text) => {
      const itemEl = document.createElement('div')
      Object.assign(itemEl.style, {
        fontSize: '12px',
        padding: '8px 4px',
        borderBottom: '1px solid black',
        backgroundColor: 'white',
        color: 'black',
        height: '34px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      })

      const textEl = document.createElement('span')
      textEl.textContent = text

      const actionEl = document.createElement('div')
      Object.assign(actionEl.style, {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      })
      const dateEl = document.createElement('span')
      Object.assign(dateEl.style, {
        color: 'black',
      })
      dateEl.textContent = new Date(this.banList[text]).toLocaleString(
        'ru-RU',
        {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
        },
      )

      const removeButtonEl = document.createElement('button')
      removeButtonEl.title = 'Удалить из заблокированного'
      Object.assign(removeButtonEl.style, {
        ...styles.button,
      })

      const removeHandler = () => {
        if (confirm(`Удалить "${text}" из списка заблокированных?`)) {
          removeButtonEl.removeEventListener('click', removeHandler)
          this.removeFromBanList(text)
          this._init(true)
        }
      }
      removeButtonEl.addEventListener('click', removeHandler)

      const removeButtonIconEl = document.createElement('span')
      removeButtonIconEl.textContent = '❌'
      Object.assign(removeButtonIconEl.style, {
        ...styles.icon,
      })

      removeButtonEl.append(removeButtonIconEl)
      actionEl.append(dateEl)
      actionEl.append(removeButtonEl)
      itemEl.append(textEl)
      itemEl.append(actionEl)

      return itemEl
    }
    const createBanListEl = () => {
      if (searchResultsBlock.firstChild[dataTags.banList] === 'true') {
        searchResultsBlock.firstChild.remove()
      }

      const container = document.createElement('div')
      container[dataTags.listContainer] = 'true'
      Object.assign(container.style, {
        padding: '8px',
        backgroundColor: 'white',
        color: 'black',
        border: '1px solid black',
        zIndex: '1',
        marginBottom: '8px',
      })

      const titleEl = document.createElement('div')
      titleEl.textContent = 'Заблокированные имена'
      Object.assign(titleEl.style, {
        fontSize: '16px',
        marginBottom: '8px',
      })
      container.append(titleEl)

      const listEl = document.createElement('div')
      listEl[dataTags.banList] = 'true'
      Object.assign(listEl.style, {
        display: 'flex',
        gap: '4px',
        flexFlow: 'column',
        maxHeight: '180px',
        overflowY: 'auto',
        minWidth: '100px',
        padding: '0',
        listStyle: 'none',
      })

      const updateItems = (items) => {
        if (!Array.isArray(items)) {
          throw new Error('Items должен быть массивом')
        }
        ;[...listEl.children].forEach((child) => child.remove())
        items.forEach((item) => {
          listEl.append(createBanListItem(item))
        })
      }

      const createBanListFilter = () => {
        const inputFilterEl = document.createElement('input')
        inputFilterEl.placeholder = 'Поиск...'
        inputFilterEl.addEventListener('input', ({ target }) => {
          const value = target.value
          const items = this.banKeys.filter((i) => i.includes(value))
          updateItems(items)
        })
        return inputFilterEl
      }
      container.append(createBanListFilter())
      updateItems(this.banKeys)
      container.append(listEl)

      return container
    }
    searchResultsBlock.prepend(createBanListEl())
  }

  _init(update) {
    if (!this.validateHref()) return

    this.setupAuthorBan(update)
    this.setupUiBanList(update)
  }
}

const instance = new AuthorRemover()

window.$AuthorRemover = instance
instance._init()
