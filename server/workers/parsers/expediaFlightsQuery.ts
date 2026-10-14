/**
 * Expedia flights GraphQL document (flights-shopping-pwa), reconstructed verbatim
 * from the public webpack bundles served on https://www.expedia.com/Flights-Search
 * (c.travel-assets.com/flights-shopping-pwa/*.js) on 14 Oct 2026:
 * operationName FlightsSearchResultsLoadedQuery, root field flightsSearch(...).
 * All 237 fragment definitions are included so the document validates exactly
 * like the real PWA's. Introspection is disabled on Expedia's /graphql, so the
 * document IS the schema contract — do not hand-edit fragments.
 */
export const EXPEDIA_FLIGHTS_QUERY = `query FlightsSearchResultsLoadedQuery($context: ContextInput!, $flightsSearchContext: FlightsSearchContextInput, $journeyCriteria: [FlightsJourneyCriteriaInput!]!, $travelerDetails: [FlightsTravelerDetailsInput!], $searchFilterValuesList: [FlightsSearchFilterValuesInput!], $sortOption: FlightsSortOptionTypeInput, $queryState: FlightsQueryState, $searchPreferences: FlightsSearchPreferencesInput, $searchPagination: PaginationInput, $flightsSearchComponentCriteria: FlightsSearchComponentCriteriaInput, $shoppingContext: ShoppingContextInput, $faresSeparationType: FlightsFaresSeparationType, $rewardsOption: RewardsOption, $fareCalendarPrice: String, $flightsDisplayComponentValues: FlightsDisplayComponentValuesInput, $virtualAgentContext: VirtualAgentContextInput, $progressiveRenderingInput: FlightsProgressiveRenderingInput, $insuranceCriteria: InsuranceCriteriaInput) { flightsSearch(context: $context, flightsSearchContext: $flightsSearchContext, journeyCriteria: $journeyCriteria, travelerDetails: $travelerDetails, searchFilterValuesList: $searchFilterValuesList, sortOption: $sortOption, queryState: $queryState, searchPreferences: $searchPreferences, searchPagination: $searchPagination, flightsSearchComponentCriteria: $flightsSearchComponentCriteria, shoppingContext: $shoppingContext, faresSeparationType: $faresSeparationType, rewardsOption: $rewardsOption, fareCalendarPrice: $fareCalendarPrice, flightsDisplayComponentValues: $flightsDisplayComponentValues, virtualAgentContext: $virtualAgentContext, progressiveRenderingInput: $progressiveRenderingInput, insuranceCriteria: $insuranceCriteria) { flightsSheets { ...FlightsSheetTypeFragment } dialogs { ...FlightsDialogPresentationFragment } listingResult { ...FlightsLoadedListingResultFragment } clientMetadata { ...FlightsPWAMetadataFragment } noListingMessaging { ...FlightsErrorMessagingPresentationFragment } ...FlightsSearchLegacyFieldsFragment } }

fragment FlightsSheetTypeFragment on FlightsSheetType {
    id
    initialState
    displayAnalytics {
      ...ClientSideAnalyticsFragment
    }
    egcsDisplayAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    egcsCloseAnalytics
    title {
      ...EGDSHeadingFragment
    }
    sheet {
      ...EGDSSheetFragment
    }
    content {
      ...FlightsSheetInfoContentFragment
      ...FlightsSheetActionContentFragment
      ...FlightsSheetMessageContentFragment
      ...FlightsAncillaryRecommendationsContentFragment
      ...FlightsSheetRadioContentFragment
    }
  }

fragment FlightsDialogPresentationFragment on FlightsDialogPresentation {
    actions {
      ...FlightsActionFragment
    }
    animation
    displayedAnalytics {
      ...FlightsAnalyticsFragment
    }
    header
    message
    title
    ... on FlightsDialogStaleSession {
      timeoutInSeconds
    }
    ...FlightsForcedChoiceCrossSellDialogFragment
  }

fragment FlightsLoadedListingResultFragment on FlightsLoadedListingResult {
    toasts {
      ...EGDSToastFragment
    }
    changeForAnyReasonWarningBanner {
      ...FlightsBannerPlacardsFragment
    }
    listings {
      ...FlightsStandardOfferFragment
      ...FlightsCreditsAvailableListingFragment
      ...FlightsCrossSellMessageFragment
      ...FlightsCrossSellOfferFragment
      ...FlightsListingMessagingCardFragment
      ...FlightsSponsoredContentAdListingFragment
      ...FlightsHeaderListingFragment
      ...FlightsBargainFareOfferFragment
      ...FlightsCarryOverFiltersCardFragment
      ...FlightsInsurtechPrimingCardListingFragment
      ...FlightsFuzzyFilterCardFragment
      ... on FlightsQuickFiltersContainerListing {
        _noop
      }
      ...FlightsManagedBannerListingFragment
    }
    flightsListingsAnalytics {
      pinnedListingDisplayedAnalytics {
        ...FlightsAnalyticsFragment
      }
      bestSortDisplayedAnalytics {
        ...FlightsAnalyticsFragment
      }
      fareUpsellPercentageAnalytics {
        ...FlightsAnalyticsFragment
      }
      nonstopSectionDisplayedAnalytics {
        ...FlightsAnalyticsFragment
      }
      urgencyMessageAnalytics {
        ...FlightsAnalyticsFragment
      }
      moreListingsDisplayedAnalytics {
        ...FlightsAnalyticsFragment
      }
      onViewedAnalyticsList {
        ...FlightsAnalyticsFragment
      }
      sponsoredUpsellAvailableAnalytics {
        ...ClientSideAnalyticsFragment
      }
      fareCalendarAnalytics {
        ...FlightsAnalyticsFragment
      }
    }
    flightsListingsEGCSAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    moreListingsAvailable
    listingsAction {
      ...FlightsActionFragment
    }
    appliedSortingAccessibility
    appliedFilterAccessibility
    showMoreListingLoadedAccessibilityMessage
    pinnedListingUnavailableMessage
    flightsLoadedListingsStatus
    progressiveRenderingListingsStatus
  }

fragment FlightsPWAMetadataFragment on FlightsPWAMetadata {
    evaluatedExperiments {
      bucket
      id
    }
    pageNameAnalytics {
      ...FlightsAnalyticsFragment
    }
    pageName
    responseMetrics {
      name
      value
    }
    responseTags
  }

fragment FlightsErrorMessagingPresentationFragment on FlightsErrorMessagingPresentation {
    icon {
      ...IconFragments
    }
    message
    title
    egcsDisplayAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    ...FlightsActionableErrorMessagingFragment
    ...FlightsNoFlightsFoundWithFilterMessagingFragment
    ...FlightsNoFlightsFoundMessagingFragment
    ...FlightsSmartNoFlightsFoundMessagingFragment
  }

fragment FlightsSearchLegacyFieldsFragment on FlightsSearchResponse {
    sortAndFilterResult {
      __typename
    }
    rewardsPricingInfo {
      title {
        __typename
        longMessage
        shortMessage
      }
      options {
        ... on FlightsRewardsOption {
          label
          identifier
          selected
          accessibility {
            ... on FlightsAccessibilityMessage {
              usage
              onCompletion
            }
          }
        }
      }
      rewardsBanner {
        ...FlightsCollapsiblePlacard
      }
      subText {
        completeText
        delimeter
        items {
          __typename
          styles
          text
          ... on FlightsPhraseLinkNode {
            accessibility
            analytics {
              ...FlightsAnalyticsFragment
            }
            icon
            link
          }
          ... on FlightsPhraseDialogNode {
            dialog {
              __typename
              title
              message
              animation
              actions {
                ...FlightsActionFragment
              }
              displayedAnalytics {
                ...FlightsAnalyticsFragment
              }
            }
            actionableIcon {
              ... on Icon {
                id
                description
                token
              }
            }
          }
        }
      }
      loyaltyBanners {
        ...FlightsIconPlacard
        ...FlightsImagePlacard
        ...FlightsCollapsiblePlacard
      }
    }
    pointsToggle {
      checked
      checkedAccessibilityLabel
      checkedAnalytics {
        ...ClientSideAnalytics
      }
      checkedDescription
      checkedLabel
      enabled
      uncheckedAccessibilityLabel
      uncheckedAnalytics {
        ...ClientSideAnalytics
      }
      uncheckedDescription
      uncheckedLabel
      ... on FlightsSwitchToggle {
        impressionAnalytics
        checkedInteractionAnalytics
        uncheckedInteractionAnalytics
      }
    }
    pageTitle {
      date {
        longMessage
        shortMessage
      }
      disclaimerSubTitle {
        ...FlightsPhraseFragment
        size
      }
      title {
        longMessage
        shortMessage
      }
    }
    allBanners {
      ...FlightsIconPlacard
    }
    cheapestListingInfo {
      price
      analytics {
        ...FlightsAnalyticsFragment
      }
      nffAnalytics {
        ...FlightsAnalyticsFragment
      }
      deviationAnalytics {
        ...FlightsAnalyticsFragment
      }
    }
    gaiaId
    stepIndicator {
      errorAnalytics {
        ...FlightsAnalyticsFragment
      }
      journeyContinuationId
    }
    shoppingContext {
      multiItem {
        id
        packageType
      }
    }
    listingsHeaderPlacards {
      ...FlightsMessagingCardPlacardsFragment
    }
  }

fragment ClientSideAnalyticsFragment on ClientSideAnalytics {
    linkName
    referrerId
  }

fragment FlightsClickStreamAnalyticsFragment on FlightsClickStreamAnalytics {
  event {
    ...EGAnalyticsTrackingFragment
  }
  payload
}

fragment EGDSHeadingFragment on EGDSHeading {
  __typename
  text
  headingType
}

fragment EGDSSheetFragment on EGDSSheet {
  closeAccessibility
  closeAnalytics {
    ...ClientSideAnalytics
  }
  closeText
  sheetTypes {
    ...EGDSSheetTypePerViewSizeFragment
  }
}

fragment FlightsSheetInfoContentFragment on FlightsSheetInfoContent {
  heading {
    ...EGDSHeadingFragment
  }
  message {
    ...EGDSParagraphFragment
  }
}

fragment FlightsSheetActionContentFragment on FlightsSheetActionContent {
  graphic {
    ...UIGraphicFragment
  }
  heading {
    ...EGDSHeadingFragment
  }
  message {
    ...EGDSParagraphFragment
  }
  primaryButton {
    ...FlightsExperienceActionButtonFragment
  }
}

fragment FlightsSheetMessageContentFragment on FlightsSheetMessageContent {
    flightPills {
      ...FlightsPillFragment
    }
    content {
      ...FlightsMessageContentSuccessFragment
      ...FlightsMessageContentFailureFragment
    }
  }

fragment FlightsAncillaryRecommendationsContentFragment on FlightsAncillaryRecommendationsContent {
    subHeading
    contentList {
      ...EGDSTextIconListFragment
    }
    ancillaryPriceAndInfoSection {
      recommendedItems {
        ...EGDSSpannableTextFragment
      }
      totalPrice {
        primaryText {
          ...EGDSSpannableTextFragment
        }
        secondaryText {
          ...EGDSSpannableTextFragment
        }
        accessibilityInfo
      }
    }
    actionButtons: footer {
      ...FlightsExperienceActionButtonFragment
    }
  }

fragment FlightsSheetRadioContentFragment on FlightsSheetRadioContent {
    radioGroup {
      ...FlightsBaggageRadioButtonGroupFragment
    }
  }

fragment FlightsActionFragment on FlightsAction {
    analyticsList {
      linkName
      referrerId
    }
    displayType
    relativeURI {
      relativePath
    }
    displayAnalytics {
      linkName
      referrerId
    }
    clientSideAnalyticsList {
      ...ClientSideAnalyticsFragment
    }
    egcsOnClickAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    onClickAnalytics
    type
    enable
    disabledAccessibilityHint
    ...FlightActionContentFragment
  }

fragment FlightsAnalyticsFragment on FlightsAnalytics {
  __typename
  linkName
  referrerId
}

fragment FlightsForcedChoiceCrossSellDialogFragment on FlightsForcedChoiceCrossSellDialog {
    annotation {
      completeText
      accessibility
      items {
        styles
        text
        ...FlightsPhraseLinkNodeFragment
      }
    }
    checkInDate {
      ...FlightsSearchFormDateFieldFragment
    }
    checkOutDate {
      ...FlightsSearchFormDateFieldFragment
    }
    displayBlockedAnalytics {
      ...FlightsAnalyticsFragment
    }
    displayCounter
    hotelDatesTitle
    messageBody {
      ...EGDSTextFragment
    }
    recommendedHotels {
      ...FlightsForcedChoiceCrossSellLodgingCardFragment
    }
    recommendedCars {
      card {
        ...EGDSImageLinkCardFragment
      }
    }
    themeProvider {
      lightMode {
        themeProviderColor
      }
    }
  }

fragment EGDSToastFragment on EGDSToast {
    text
    actionText
    action {
      ...ActionFragment
    }
  }

fragment FlightsBannerPlacardsFragment on FlightsBannerPlacard {
    banner {
      actions {
        ...ActionFragment
      }
      icon {
        ...IconFragments
      }
      egdsElementId
      fullWidth
      heading
      message
      theme
    }
    onViewedAnalyticsList {
      ...ClientSideAnalyticsFragment
    }
    onViewedEgcsAnalytics
  }

fragment FlightsStandardOfferFragment on FlightsStandardOffer {
    pinnedOfferMessage
    badgesList {
      ...EGDSBadgeFragment
    }
    flightsShoppingOfferContent {
      ...FlightsShoppingOfferContentFragment
    }
    journeys {
      adjustedStayDatesMessage {
        ...AdjustedStayDatesMessageFragment
      }
      positiveHighlightsMessage
      urgencyMessage
      urgencyAccessibilityMessage
      detailsAndFares {
        ...FlightsDetailsAndFaresPresentationFragment
      }
      trigger {
        ...FlightsExperienceDialogTriggerFragment
      }
      triggerList {
        ...FlightsExperienceDialogTriggerFragment
      }
      dialogSheet {
        ...FlightsDialogSheetFragment
      }
      triggerDelimiter {
        ...EGDSStylizedTextFragment
      }
    }
    selectOfferAction {
      type
    }
    pricingInformation {
      partnerLoyaltyEarnMessage {
        ...FlightsMarkAndLabelFragment
      }
    }
    secondaryBadges {
      ...EGDSBadgeFragment
    }
    priceDisplay {
      ...FlightsPriceDisplayFragment
    }
    farePriceDisplayButtons {
      ...FlightsFarePriceDisplayButtonFragment
    }
    sponsoredAirline {
      ...FlightsOfferSponsoredAirlineFragment
    }
    sponsoredUpsell {
      ...FlightsOfferSponsoredUpsellFragment
    }
    stepIndicatorJcid
    offerInfoLink {
      ...OfferInfoLinkFragment
    }
    flightsOfferAnalytics {
      onViewedAnalyticsList {
        ...FlightsPhraseAnalyticsFragment
      }
    }
    onClickAnalyticsList {
      ...FlightsPhraseAnalyticsFragment
    }
    egcsDisplayAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    egcsClickAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
  }

fragment FlightsCreditsAvailableListingFragment on FlightsCreditsAvailableListing {
    toastNotification {
      ...EGDSToastFragment
    }
    messagingCardPlacard {
      ...FlightsMessagingCardPlacardsFragment
      button {
        ...FlightsActionButtonFragment
      }
    }
  }

fragment FlightsCrossSellMessageFragment on FlightsCrossSellMessage {
    multiItemFlightCrossSellPrimer {
      ...MultiItemFlightCrossSellPrimerFragment
    }
  }

fragment FlightsCrossSellOfferFragment on FlightsCrossSellOffer {
    multiItemFlightCrossSellOfferPrimer {
      multiItemSearchContext {
        ...MultiItemSearchContextFragment
      }
      multiItemPackageableProduct {
        ...MultiItemPackageableProductFragment
      }
      brandedDealFallBack {
        ...MultiItemFlightCrossSellPrimerFragment
      }
      multiItemPricedPackageableProducts {
        ...MultiItemPricedPackageableProductFragment
      }
      price {
        base {
          amount
        }
        taxesAndFees {
          amount
        }
      }
    }
  }

fragment FlightsListingMessagingCardFragment on FlightsListingMessagingCard {
    messagingCard {
      ...FlightsMessagingCardPlacardsFragment
    }
  }

fragment FlightsSponsoredContentAdListingFragment on FlightsSponsoredContentAdListing {
    sponsoredContentPlacement {
      ...SponsoredContentPlacementFragment
    }
  }

fragment FlightsHeaderListingFragment on FlightsHeaderListing {
    headingSize
    heading
    subHeading
    contents {
      ...EGDSSpannableTextFragment
    }
    items {
      ...EGDSSpannableTextFragment
      ...FlightsHeaderWithInlineDialogTriggerFragment
      ... on FlightsHeaderLoadingLineItem {
        loadingStatus
        loadingText: text {
          ...EGDSSpannableTextFragment
        }
      }
    }
  }

fragment FlightsBargainFareOfferFragment on FlightsBargainFareOffer {
    accessibilityHeading
    accessibilityMessage
    priceDisplay {
      ...FlightsPriceDisplayFragment
    }
    description {
      completeText
    }
    graphic {
      ...UIGraphicFragment
    }
    header {
      completeText
    }
    journeyContinuationId
    journeys {
      detailsAndFares {
        ...FlightsDetailsAndFaresPresentationFragment
      }
    }
    selectOfferAction {
      type
    }
    onClickAnalyticsList {
      linkName
      referrerId
    }
    stepIndicatorJcid
    egcsDisplayAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    egcsClickAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
  }

fragment FlightsCarryOverFiltersCardFragment on FlightsCarryOverFiltersCard {
    actionElement {
      ...FlightsActionLinkFragment
    }
    displayAnalytics {
      ...ClientSideAnalyticsFragment
    }
    icon {
      ...IconFragments
    }
    message
  }

fragment FlightsInsurtechPrimingCardListingFragment on InsurtechPrimingCardListing {
    insurtechSearchCriteria {
      ...InsurtechSearchCriteriaFragment
    }
    placement {
      placementContext {
        lob
        packageType
        path
        placement
      }
    }
  }

fragment FlightsFuzzyFilterCardFragment on FlightsFuzzyFilterCard {
    image {
      ...UIGraphicFragment
    }
    heading
    fuzzyFilterMessage: message
    clearFiltersAction {
      ...FlightsActionFragment
    }
    egcsDisplayAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    selectedFilterPills {
      ...AppliedFilterFragment
    }
  }

fragment FlightsManagedBannerListingFragment on FlightsManagedBannerListing {
    _noop
  }

fragment IconFragments on Icon {
    description
    id
    size
    theme
    title
    withBackground
    spotLight
  }

fragment FlightsActionableErrorMessagingFragment on FlightsActionableErrorMessaging {
    action {
      ...FlightsActionFragment
    }
    errorRecoveryButtons {
      ...FlightsActionFragment
    }
    subMessage
  }

fragment FlightsNoFlightsFoundWithFilterMessagingFragment on FlightsNoFlightsFoundWithFilterMessaging {
    clearFiltersAction {
      ...FlightsActionFragment
    }
  }

fragment FlightsNoFlightsFoundMessagingFragment on FlightsNoFlightsFoundMessaging {
    FlightsNoFlightsFoundMessagingAction: action {
      ...FlightsExperienceActionButtonFragment
    }
  }

fragment FlightsSmartNoFlightsFoundMessagingFragment on FlightsSmartNoFlightsFoundMessaging {
    alternateAirportOptions {
      ...AlternateAirportOptionsFragment
    }
    alternateDateOptions {
      ...AlternateDateOptionsFragment
    }
    editSearchButton {
      ...FlightsActionFragment
    }
    flightsDisplayComponentCountingValue {
      displayCount
      flightsDisplayComponent
    }
  }

fragment FlightsCollapsiblePlacard on FlightsCollapsiblePlacard {
  __typename
  heading
  message
  backgroundTheme
  graphic {
    ...UIGraphicFragment
  }
  messageWithMoreInfo {
    ...FlightsPointsMoreInfoLink
  }
  actions {
    ...FlightAction
  }
  onViewedAnalytics {
    ...FlightsAnalytics
  }
  onViewedAnalyticsList {
    ...ClientSideAnalytics
  }
}

fragment FlightsIconPlacard on FlightsIconPlacard {
  __typename
  heading
  message
  icon {
    description
    id
    size
    withBackground
  }
  actions {
    ...FlightAction
  }
  displayType
  backgroundTheme
}

fragment FlightsImagePlacard on FlightsImagePlacard {
  __typename
  heading
  message
  image {
    description
    url
  }
  actions {
    ...FlightAction
  }
  displayType
  backgroundTheme
}

fragment ClientSideAnalytics on ClientSideAnalytics {
  linkName
  referrerId
  uisPrimeMessages {
    messageContent
    schemaName
  }
}

fragment FlightsPhraseFragment on FlightsPhrase {
    accessibility
    completeText
    items {
      ...FlightsPhrasePartFragment
    }
  }

fragment FlightsMessagingCardPlacardsFragment on FlightsMessagingCardPlacard {
    actionElement {
      ...FlightsActionLinkFragment
    }
    backgroundTheme
    messagingCard {
      primary
      secondaries
      graphic {
        ...UIGraphicFragment
      }
      egdsElementId
    }
    flightsMessagingCard {
      header {
        ...EGDSSpannableTextFragment
      }
      contents {
        ...EGDSSpannableTextFragment
      }
      graphic {
        ...UIGraphicFragment
      }
    }
    actionPosition
    onViewedAnalyticsList {
      ...ClientSideAnalyticsFragment
    }
    onViewedEgcsAnalytics
  }

fragment EGAnalyticsTrackingFragment on EGClickstreamEvent {
  eventCategory
  eventName
  eventType
  eventVersion
  actionLocation
}

fragment EGDSSheetTypePerViewSizeFragment on EGDSSheetTypePerViewSize {
  sheetType
  viewSize
}

fragment EGDSParagraphFragment on EGDSParagraph {
  __typename
  text
  style
}

fragment UIGraphicFragment on UIGraphic {
  ...IconSearch
  ...MarkFragments
  ...EgdsGraphicIllustrationFragmentSearch
}

fragment FlightsExperienceActionButtonFragment on FlightsExperienceActionButton {
  __typename
  accessibility
  clientAction {
    __typename
    accessibility
    analyticsList {
      ...ClientSideAnalytics
    }
    ...FlightsSelectionAction
  }
  primary
}

fragment FlightsPillFragment on FlightsPill {
    actionAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    displayAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    pill {
      ...EGDSPillFragment
    }
  }

fragment FlightsMessageContentSuccessFragment on FlightsMessageContentSuccess {
    contentId
    additionalInformation {
      ...FlightsContentBlockFragment
    }
    egcsAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    infoCards {
      ...EGDSStandardMessagingCardFragment
    }
    messageCardContent {
      ...FlightsMessageCardContentFragment
    }
  }

fragment FlightsMessageContentFailureFragment on FlightsMessageContentFailure {
    contentId
    errors {
      ...FlightErrorMessagingPresentationFragment
    }
    egcsAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
  }

fragment EGDSTextIconListFragment on EGDSTextIconList {
    listItems {
      text
      icon {
        ...IconFragments
      }
    }
    textListSize: size
  }

fragment EGDSSpannableTextFragment on EGDSSpannableText {
  __typename
  text
  contents {
    __typename
    ... on EGDSHeading {
      text
      headingType
    }
    ... on EGDSParagraph {
      ...EGDSParagraphFragment
    }
    ... on EGDSIconText {
      text
      icon {
        id
        size
        theme
      }
    }
    ... on EGDSStandardLink {
      text
      size
      standardLinkIcon: icon {
        ...IconFragment
      }
      iconPosition
      action {
        __typename
        accessibility
        target
        resource {
          __typename
          value
        }
        analytics {
          __typename
          linkName
          referrerId
        }
      }
    }
    ... on EGDSPlainText {
      text
    }
    ... on EGDSStylizedText {
      decorative
      text
      theme
      weight
      stylizedSize: size
    }
  }
  inlineContent {
    __typename
    ... on EGDSHeading {
      text
      headingType
    }
    ... on EGDSGraphicText {
      ...EGDSGraphicTextFragment
    }
    ... on EGDSInlineLink {
      ...EGDSInlineLinkFragment
    }
    ... on EGDSStandardLink {
      text
      size
      standardLinkIcon: icon {
        ...IconFragment
      }
      iconPosition
      action {
        __typename
        accessibility
        target
        resource {
          __typename
          value
        }
        analytics {
          __typename
          linkName
          referrerId
        }
      }
    }
    ... on EGDSPlainText {
      text
    }
    ... on EGDSStylizedText {
      decorative
      text
      theme
      weight
      stylizedSize: size
    }
  }
}

fragment FlightsBaggageRadioButtonGroupFragment on FlightsBaggageRadioButtonGroup {
    baggageRadioButtons {
      ...FlightsBaggageRadioButtonFragment
    }
    errorMessage
    groupName
    label
    selected
    options {
      ...EGDSBasicRadioButtonFragment
    }
  }

fragment FlightActionContentFragment on FlightsAction {
    flightsActionContentA11yMessage: accessibilityMessage
    displayAction
  }

fragment FlightsPhraseLinkNodeFragment on FlightsPhraseLinkNode {
    accessibility
    analytics {
      ...FlightsPhraseAnalyticsFragment
    }
    displayAnalytics {
      ...FlightsPhraseAnalyticsFragment
    }
    scrollAnalytics {
      ...FlightsPhraseAnalyticsFragment
    }
    icon
    link
    styles
    text
  }

fragment FlightsSearchFormDateFieldFragment on FlightsSearchFormDateField {
    analytics {
      ...FlightsAnalyticsFragment
    }
    currentError
    date {
      day
      month
      year
      formatted(format: "d MMM uuuu")
      isoFormat
    }
    dateFormat
    daysBookableInAdvance
    label
    placeholder
    possibleErrors {
      analytics {
        ...FlightsAnalyticsFragment
      }
      message
      type
    }
    maxStayDurationAllowed
    possibleErrorsHeader {
      icon {
        id
        description
      }
      label {
        completeText
        items {
          styles
          text
        }
      }
    }
    doneAction
  }

fragment EGDSTextFragment on EGDSText {
    __typename
    ...EGDSHeadingFragment
    ...EGDSGraphicTextFragment
    ...EGDSSpannableTextFragment
    ...EGDSPlainTextFragment
    ...EGDSStylizedTextFragment
    ...EGDSIconTextFragment
    ...EGDSParagraphFragment
    ...EGDSStandardLinkFragment
    ...EGDSInlineLinkFragment
    ...EGDSTextStandardListItemFragment
  }

fragment FlightsForcedChoiceCrossSellLodgingCardFragment on FlightsForcedChoiceCrossSellLodgingCard {
    id
    header {
      heading
      messages {
        ... on EGDSPlainText {
          text
          accessibility
        }
      }
      amenities {
        ...EGDSGraphicTextFragment
      }
    }
    media {
      accessibilityHeadingText
      nextButtonText
      previousButtonText
      media {
        ... on FlightMediaItem {
          media {
            ... on Image {
              url
              description
            }
          }
        }
      }
    }
    summarySections {
      guestRatingSection {
        badge {
          text
          accessibility
          badgeTheme: theme
          badgeSize: size
        }
        phrases {
          accessibilityLabel
          phraseParts {
            ...EGDSStylizedTextFragment
          }
        }
      }
      amenities {
        ...EGDSGraphicTextFragment
      }
    }
    impressionAnalytics {
      linkName
      referrerId
      event
    }
    cardLink {
      resource {
        __typename
        value
      }
      analytics {
        linkName
        referrerId
      }
    }
  }

fragment EGDSImageLinkCardFragment on EGDSImageLinkCard {
    link {
      image {
        aspectRatio
        description
        url
      }
      action {
        ...UILinkActionFragment
      }
    }
  }

fragment ActionFragment on UILinkAction {
    accessibility
    analytics {
      linkName
      referrerId
    }
    resource {
      value
      ... on HttpURI {
        relativePath
      }
    }
    target
    useRelativePath
  }

fragment EGDSBadgeFragment on EGDSBadge {
  __typename
  accessibility
  text
  theme
  size
}

fragment FlightsShoppingOfferContentFragment on FlightsShoppingOfferContent {
    graphic {
      ...UIGraphicFragment
    }
    primarySection {
      ...FlightsShoppingPrimarySectionFragment
    }
    secondarySection {
      ...FlightsShoppingSecondarySectionFragment
    }
    tertiarySection {
      ...FlightShoppingCardTertiarySectionFragment
    }
    additionalMessageList {
      ...FlightsOfferAdditionalMessageFragment
    }
    additionalMessages {
      ...EGDSGraphicTextFragment
    }
  }

fragment AdjustedStayDatesMessageFragment on FlightsIconPhrases {
    icon {
      ...IconFragments
    }
    text {
      ...FlightsPhraseFragment
    }
  }

fragment FlightsDetailsAndFaresPresentationFragment on FlightsDetailsAndFaresPresentation {
  __typename
  content {
    ...FlightsDetailsAndFaresContentFragment
  }
  flightsFaresWrapper {
    ...FlightsDialogSheetFragment
  }
  footer {
    ...FlightsDetailsAndFaresFooterFragment
  }
  trigger {
    ...FlightsDialogTriggerFragment
  }
  sideSheetInformationText {
    ...TextWrapperFragment
  }
  airlineTabs {
    ...EGDSBasicTabsFragment
  }
}

fragment FlightsExperienceDialogTriggerFragment on FlightsExperienceDialogTrigger {
    dialogAction
    dialogId
    dynamicDialogId
    trigger {
      ...FlightsExperienceActionLinkFragment
      ...FlightsDialogTriggerTypeFragment
    }
  }

fragment FlightsDialogSheetFragment on FlightsDialogSheet {
  __typename
  dialog {
    ...FaresDialogsFragment
  }
  dialogId
  dynamicDialogId
  sheet {
    ...FlightsSideSheetFragment
  }
  sheetInfo {
    ...FlightsSheetFragment
  }
}

fragment EGDSStylizedTextFragment on EGDSStylizedText {
  decorative
  accessibility
  stylizedSize: size
  text
  theme
  weight
}

fragment FlightsMarkAndLabelFragment on FlightsMarkAndLabel {
    accessibility
    label
    subLabel
    mark {
      id
      description
    }
    stylisedText {
      ...EGDSSpannableTextFragment
    }
  }

fragment FlightsPriceDisplayFragment on FlightsPriceDisplay {
  rows {
    elements {
      ... on FlightsPriceMessageItem {
        price {
          ...EGDSStylizedTextFragment
        }
        disclaimer {
          ... on FlightsPricingDisclaimer {
            actionDialog {
              ... on EGDSActionDialog {
                footer {
                  buttons {
                    ...EGDSButtonFragment
                    ...UITertiaryButtonSearchFragment
                  }
                }
              }
            }
            triggerAnalytics {
              ... on FlightsClickStreamAnalytics {
                event {
                  ... on EGClickstreamEvent {
                    eventCategory
                    eventName
                    eventType
                    eventVersion
                    actionLocation
                  }
                }
                payload
              }
            }
            content
            accessibilityDialogTrigger
            dialogId
            graphicAlignment
            __typename
          }
        }
        __typename
      }
      ... on FlightsEnrichedMessageItem {
        value {
          ...EGDSStylizedTextFragment
        }
        leadingGraphic {
          ...UIGraphicFragment
        }
        __typename
      }
    }
  }
  alignment
  __typename
}

fragment FlightsFarePriceDisplayButtonFragment on FlightsFarePriceDisplayButton {
    action {
      accessibility
      analyticsList {
        ...ClientSideAnalyticsFragment
      }
      egcsAnalytics {
        ...FlightsClickStreamAnalyticsFragment
      }
      dialogAction
      dialogTriggerDialogId: dialogId
      dynamicDialogId
    }
    amenityStatusList {
      primaryIcon {
        ...IconFragment
      }
      availabilityStatus
      secondaryAlignment
    }
    fareName
    fareSelectedText
    priceDisplay {
      ...FlightsPriceDisplayFragment
    }
    accessibilityText
    amenityStatusListAccessibility
  }

fragment FlightsOfferSponsoredAirlineFragment on FlightsOfferSponsoredAirline {
    airlineName
    airlineImage {
      url
    }
    sponsoredHeader
    sponsoredText
    sponsoredBeacons {
      renderBeacons
      clickBeacons
      viewBeacons
    }
    adTransparencyTrigger {
      adTransparencyId
      adTransparencyButton {
        ...AdTransparencyButtonFragment
      }
      adTransparencyOverlaySkeleton {
        title
        error {
          description
          icon {
            id
            size
          }
          button {
            primary
          }
          allowedRetryAttempts
          exceededAttemptsMessage
        }
      }
    }
  }

fragment FlightsOfferSponsoredUpsellFragment on FlightsOfferSponsoredUpsell {
    __typename
    adBadge {
      ...EGDSBadgeFragment
      ... on AdTransparencyTrigger {
        adTransparencyId
        adTransparencyButton {
          __typename
          ... on AdTransparencyButton {
            primary
            accessibility
            disabled
            size
            icon {
              description
              id
              title
            }
            analyticsPayload
          }
        }
        adTransparencyOverlaySkeleton {
          ...TransparencyOverlaySkeletonFragment
        }
      }
    }
    expando {
      ...EGDSExpandoFragment
    }
    details {
      ...FlightsSponsoredUpsellDetails
    }
    sponsoredUpsellAction {
      ...FlightsActionButtonFragment
      ...FlightsDialogTriggerFragment
    }
    onViewedAnalytics {
      ...ClientSideAnalyticsFragment
    }
    beacons {
      ...SponsoredTrackingBeaconsFragement
    }
  }

fragment OfferInfoLinkFragment on FlightsInfoLink {
    actionLink {
      primary
      clientAction {
        analyticsList {
          ...ClientSideAnalyticsFragment
        }
      }
    }
    sheet {
      ...FlightsSheetTypeFragment
    }
  }

fragment FlightsPhraseAnalyticsFragment on FlightsAnalytics {
    linkName
    referrerId
  }

fragment FlightsActionButtonFragment on FlightsActionButton {
  __typename
  accessibility
  clientAction {
    ...FlightsDialogTriggerActionFIS
  }
  disabled
  egdsElementId
  icon {
    ...IconInformationLoaded
  }
  primary
  style
  action {
    __typename
    accessibility
    analytics {
      ...ClientAnalytics
    }
  }
}

fragment MultiItemFlightCrossSellPrimerFragment on MultiItemFlightCrossSellPrimer {
    flightCrossSellProductType
    multiItemSearchContext {
      ...MultiItemSearchContextFragment
    }
  }

fragment MultiItemSearchContextFragment on MultiItemSearchContext {
    flights {
      primary {
        journeyCriterias {
          departureDate {
            ...DateFragment
          }
          origin
          destination
        }
        searchPreferences {
          cabinClass
          advancedFilters
        }
        tripType
        travelers {
          age
          type
        }
      }
      secondary {
        booleans {
          id
          value
        }
      }
    }
  }

fragment MultiItemPackageableProductFragment on MultiItemPackageableProduct {
    flights {
      offerToken
      productTokens
      travelers {
        age
        type
      }
    }
  }

fragment MultiItemPricedPackageableProductFragment on MultiItemPricedPackageableProduct {
    flight {
      offerToken
      productTokens
      travelers {
        age
        type
      }
    }
    brandedDealPrice {
      base {
        amount
      }
      taxesAndFees {
        amount
      }
    }
    subjectToGovernmentApproval
  }

fragment SponsoredContentPlacementFragment on SponsoredContentPlacement {
    productType
    sponsoredContentContext {
      sponsoredContentId
      variant
      pageName
      targeting {
        adults
        dateEnd {
          day
          month
          year
        }
        dateStart {
          day
          month
          year
        }
        kids
        locationResolver
        destination
        origin
      }
    }
  }

fragment FlightsHeaderWithInlineDialogTriggerFragment on FlightsHeaderWithInlineDialogTrigger {
    items {
      text {
        ...EGDSSpannableTextFragment
      }
      trigger {
        ...FlightsExperienceDialogTriggerFragment
      }
    }
  }

fragment FlightsActionLinkFragment on FlightsActionLink {
  __typename
  clientAction {
    ...FlightsClientActionFragment
  }
  disabled
  primary
  icon {
    ...IconSearch
  }
  analytics {
    ...ClientSideAnalytics
  }
}

fragment InsurtechSearchCriteriaFragment on InsurtechSearchCriteria {
    flightSearchCriteria {
      primary {
        journeyCriterias {
          arrivalDate {
            day
            month
            year
          }
          departureDate {
            day
            month
            year
          }
          destination
          origin
        }
        travelers {
          age
          type
        }
        tripType
      }
    }
  }

fragment AppliedFilterFragment on ShoppingSortAndFilterAppliedFilter {
    pill {
      ...FlightsEGDSRemovablePillFragment
    }
    nextSearchCriteria {
      ...ShoppingSearchCriteriaFragment
    }
  }

fragment AlternateAirportOptionsFragment on AlternateAirportOptions {
    accessibilityTitle
    airportOptions {
      ...AirportOptionFragment
    }
    airportOptionAnalytics {
      ...FlightsAnalyticsFragment
    }
    alternateOptionTitle
  }

fragment AlternateDateOptionsFragment on AlternateDateOptions {
    accessibilityTitle
    alternateOptionTitle
    dateOptionAnalytics {
      ...FlightsAnalyticsFragment
    }
    dateOptions {
      ...DateOptionFragment
    }
  }

fragment FlightsPointsMoreInfoLink on FlightsPointsMoreInfoLink {
  __typename
  content {
    ...FlightsPointsInformationDialogContent
  }
  dialog {
    ...FaresDialogsFragment
  }
  text
}

fragment FlightAction on FlightsAction {
  __typename
  accessibilityMessage
  analytics {
    ...FlightsAnalytics
  }
  analyticsList {
    ...FlightsAnalytics
  }
  displayAnalytics {
    ...FlightsAnalytics
  }
  displayAction
  displayType
  accessibilityActionMessage {
    usage
    onCompletion
  }
  icon {
    ...IconSearch
  }
  journeySearchCriteria {
    previousFlightSelections {
      journeyIndex
      offerIdentifier
    }
    journeyCriteria {
      originAirportLocationType
      destinationAirportLocationType
      destination
      departureDate {
        day
        month
        year
      }
      origin
    }
    searchPreferences {
      cabinClass
    }
  }
  relativeURI {
    relativePath
    value
  }
  relativePackageableURI {
    relativePath
    value
  }
  stepIndicator {
    ...FlightsStepIndicator
  }
  searchPagination {
    ...Pagination
  }
  type
}

fragment FlightsAnalytics on FlightsAnalytics {
  __typename
  linkName
  referrerId
}

fragment FlightsPhrasePartFragment on FlightsPhrasePart {
  __typename
  ... on FlightsPhraseTextNode {
    ...FlightsPhraseTextNodeFragment
  }
}

fragment IconSearch on Icon {
  __typename
  description
  id
  size
  withBackground
  theme
  title
  spotLight
  token
}

fragment MarkFragments on Mark {
  __typename
  description
  id
  markSize: size
  url {
    ... on HttpURI {
      __typename
      relativePath
      value
    }
  }
}

fragment EgdsGraphicIllustrationFragmentSearch on Illustration {
  __typename
  link: url
  id
  description
  egdsElementId
}

fragment FlightsSelectionAction on FlightsSelectionAction {
  value
}

fragment EGDSPillFragment on EGDSPill {
    __typename
    ...EGDSBasicPillFragment
    ...EGDSBasicRemovablePillFragment
  }

fragment FlightsContentBlockFragment on FlightsContentBlock {
    heading {
      ...EGDSHeadingFragment
    }
    message {
      ...EGDSParagraphFragment
    }
  }

fragment EGDSStandardMessagingCardFragment on EGDSStandardMessagingCard {
  dismiss {
    ...EGDSDismissActionFragment
  }
  egdsElementId
  graphic {
    ...UIGraphicFragment
  }
  heading
  links {
    ...EGDSStandardLinkFragment
  }
  message
  rightIcon {
    ...IconSearch
  }
}

fragment FlightsMessageCardContentFragment on FlightsMessageCardContent {
    content {
      ...FlightsCategorizedListItemFragment
    }
    egcsAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    header {
      ...FlightsCategorizedListItemFragment
    }
  }

fragment FlightErrorMessagingPresentationFragment on FlightsErrorMessagingPresentation {
    __typename
    ...FlightsCriticalErrorMessagingFragment
    ...FlightsInfoMessagingPresentationFragment
  }

fragment IconFragment on Icon {
  description
  id
  size
  theme
  title
  withBackground
  spotLight
}

fragment EGDSGraphicTextFragment on EGDSGraphicText {
  textGraphic: graphic {
    ...UIGraphicFragment
  }
  text
  accessibility
}

fragment EGDSInlineLinkFragment on EGDSInlineLink {
  __typename
  action {
    ...UILinkActionFragment
  }
  disabled
  size
  text
}

fragment FlightsBaggageRadioButtonFragment on FlightsBaggageRadioButton {
    onClickAnalytics
    egcsOnClickAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    label {
      ...EGDSSpannableTextFragment
    }
    subLabel {
      ...EGDSSpannableTextFragment
    }
    weightLabel {
      ...EGDSSpannableTextFragment
    }
    weightSubLabel {
      ...EGDSSpannableTextFragment
    }
    radioButton {
      ...FlightSelectableBaggageFragment
    }
    baggageSelectionAccessibilityMessages {
      ...FlightsBaggageSelectionAccessibilityMessagesFragment
    }
  }

fragment EGDSBasicRadioButtonFragment on EGDSBasicRadioButton {
    __typename
    description
    disabled
    label
    labelSuffix
    value
  }

fragment EGDSPlainTextFragment on EGDSPlainText {
  text
}

fragment EGDSIconTextFragment on EGDSIconText {
  __typename
  icon {
    ...IconSearch
  }
  text
}

fragment EGDSStandardLinkFragment on EGDSStandardLink {
  action {
    ...UILinkActionFragment
  }
  disabled
  standardLinkIcon: icon {
    ...IconSearch
  }
  iconPosition
  size
  text
}

fragment EGDSTextStandardListItemFragment on EGDSTextStandardListItem {
    text
    nestedLevelOneList {
      ...EGDSNestedLevelOneListFragment
    }
  }

fragment UILinkActionFragment on UILinkAction {
  accessibility
  analytics {
    ...ClientSideAnalytics
  }
  resource {
    value
  }
  target
  useRelativePath
}

fragment FlightsShoppingPrimarySectionFragment on FlightsShoppingPrimarySection {
    ...EGDSMoreInfoTriggerComponentFragment
  }

fragment FlightsShoppingSecondarySectionFragment on FlightsShoppingSecondarySection {
    ...FlightShoppingCardDurationTimelineFragment
    ...EGDSTextSectionFragment
  }

fragment FlightShoppingCardTertiarySectionFragment on FlightsShoppingTertiarySection {
    ...EGDSTextSectionFragment
  }

fragment FlightsOfferAdditionalMessageFragment on FlightsOfferAdditionalMessage {
    ...EGDSSpannableTextFragment
    ...EGDSGraphicTextFragment
    ...EGDSPlainTextFragment
  }

fragment FlightsDetailsAndFaresContentFragment on FlightsDetailsAndFaresContent {
  __typename
  dialogId
  dynamicDialogId
  nestedDialogs {
    ...FaresDialogsFragment
  }
  priceMatchPromiseNestedDialogs {
    ...FaresDialogsFragment
  }
  sections {
    __typename
    ...FlightsJourneyHeaderFragment
    ...FlightsJourneyDetailsInformationFragment
    ...FlightsJourneyWithDetailsFragment
    ...TextWrapperFragment
    ...FlightsFaresInformationFragment
    ...FlightsSustainabilityCardFragment
    ...FlightsMessagingCardFragment
  }
  displayAnalytics {
    ...ClientSideAnalytics
  }
}

fragment FlightsDetailsAndFaresFooterFragment on FlightsDetailsAndFaresFooter {
  __typename
  action {
    ...FlightsActionButton
  }
  dialogId
  dynamicDialogId
  priceDisplay {
    ...FlightsPriceDisplayFragment
  }
  priceLockup {
    ...PriceLockupFragment
  }
}

fragment FlightsDialogTriggerFragment on FlightsDialogTrigger {
  __typename
  dialogAction
  dialogId
  dynamicDialogId
  trigger {
    __typename
    ...FlightsActionButton
    ...FlightsActionLinkFragment
    ...FlightsExperienceActionButtonFragment
    ...FlightsExperienceActionLinkFragment
  }
}

fragment TextWrapperFragment on TextWrapper {
  textA11yMessage: accessibilityMessage
  text {
    ...EgdsTextFragment
    ...EGDSSpannableTextFragment
    __typename
  }
  __typename
}

fragment EGDSBasicTabsFragment on EGDSBasicTabs {
  egdsElementId
  selectedTabId
  tabs {
    ... on EGDSBasicTab {
      ...EGDSBasicTabFragment
    }
  }
  __typename
}

fragment FlightsExperienceActionLinkFragment on FlightsExperienceActionLink {
  __typename
  accessibility
  clientAction {
    ...FlightsClientActionFragment
  }
  disabled
  primary
  analytics {
    ...ClientSideAnalytics
  }
  icon {
    ...IconFragment
  }
}

fragment FlightsDialogTriggerTypeFragment on FlightsDialogTriggerType {
    ...FlightsExperienceActionButtonFragment
  }

fragment FaresDialogsFragment on FlightsDialog {
  dialog {
    __typename
    ...EGDSDialogFragment
  }
  dialogContent: content {
    __typename
    ...EgdsElementFragment
    ... on FlightsDialogTrigger {
      ...FlightsDialogTriggerFragment
    }
  }
  displayAnalytics {
    ...ClientSideAnalytics
  }
  dialogId
  dynamicDialogId
  initialState
}

fragment FlightsSideSheetFragment on FlightsSideSheet {
  content {
    ...EgdsElementFragment
  }
  footer {
    ...EgdsElementFragment
  }
  title
  initialState
  closeText
  __typename
}

fragment FlightsSheetFragment on FlightsSheet {
  ... on FlightsDetailSheet {
    ...FlightsDetailSheetFragment
  }
}

fragment EGDSButtonFragment on EGDSButton {
  __typename
  ...FlightsActionButton
  ...FlightsDialogTriggerFragment
}

fragment UITertiaryButtonSearchFragment on UITertiaryButton {
  accessibility
  analytics {
    ...ClientSideAnalytics
  }
  disabled
  icon {
    ...IconFragment
  }
  primary
}

fragment AdTransparencyButtonFragment on AdTransparencyButton {
  primary
  icon {
    id
  }
}

fragment TransparencyOverlaySkeletonFragment on TransparencyOverlaySkeleton {
    title
    error {
      icon {
        id
        size
      }
      description
      button {
        primary
      }
      allowedRetryAttempts
      exceededAttemptsMessage
    }
  }

fragment EGDSExpandoFragment on EGDSExpando {
  __typename
  ... on EGDSExpandoPeek {
    ...EGDSExpandoPeekFragment
  }
  ... on EGDSExpandoListItem {
    ...EGDSExpandoListItemFragment
  }
  ... on EGDSExpandoLink {
    ...EGDSExpandoLinkFragment
  }
}

fragment FlightsSponsoredUpsellDetails on FlightsSponsoredFareInformation {
  __typename
  mediaSection {
    badge {
      ...EGDSBadgeFragment
      size
    }
    featureImage {
      url
      description
      thumbnailClickAnalytics {
        ...ClientSideAnalytics
      }
    }
  }
  heading {
    __typename
    accessibility
    text
  }
  description
  highlights {
    __typename
    listItems {
      __typename
      text
    }
  }
  priceDisplay {
    ...FlightsPriceDisplayFragment
  }
  priceLockup {
    ...PriceLockupFragment
  }
  sponsoredFareAnalyticsList {
    ...ClientSideAnalytics
  }
  onClickAnalyticsList {
    ...ClientSideAnalytics
  }
  showMoreExpando {
    ...EGDSExpandoFragment
    collapseAnalytics {
      ...ClientSideAnalytics
    }
    expanded
  }
}

fragment SponsoredTrackingBeaconsFragement on SponsoredTrackingBeacons {
  renderBeacons
  clickBeacons
  viewBeacons
  __typename
}

fragment FlightsDialogTriggerActionFIS on FlightsDialogTriggerAction {
  __typename
  dialog {
    ...EGDSActionDialogFragment
  }
  analyticsList {
    __typename
    ...ClientAnalytics
  }
  dialogContents {
    __typename
    ... on EGDSHeading {
      text
    }
    ... on EGDSParagraph {
      text
    }
  }
}

fragment IconInformationLoaded on Icon {
  __typename
  description
  id
  size
  withBackground
  theme
}

fragment ClientAnalytics on ClientSideAnalytics {
  __typename
  linkName
  referrerId
  uisPrimeMessages {
    messageContent
    schemaName
  }
}

fragment DateFragment on Date {
  month
  day
  year
}

fragment FlightsClientActionFragment on FlightsClientAction {
  accessibility
  analyticsList {
    ...ClientSideAnalytics
  }
  egcsAnalytics {
    ...FlightsClickStreamAnalyticsFragment
  }
  ... on FlightsCreditSelectionAction {
    originalBookingId
  }
  ...FlightsBoundNavigation
  ...FlightsNavigateToDetails
  ...FlightsResourceLinkAction
  ...FlightsSelectionAction
  ...MultiItemSelectPackage
  ...MultiItemSelectProducts
}

fragment FlightsEGDSRemovablePillFragment on EGDSRemovablePill {
    primary
    accessibility
    disabled
    action {
      accessibility
      ... on UIFlightAction {
        analyticsPayload
      }
    }
  }

fragment ShoppingSearchCriteriaFragment on ShoppingSearchCriteria {
    selections {
      id
      value
    }
    booleans {
      id
      value
    }
    counts {
      id
      value
    }
    dates {
      id
      value {
        day
        month
        year
      }
    }
    ranges {
      id
      max
      min
    }
  }

fragment AirportOptionFragment on AirportOption {
    accessibilityHeading
    accessibilityMessage
    destinationAirportDistance
    destinationCityName
    icon {
      ...IconFragments
    }
    originAirportDistance
    originCityName
    selectAction {
      ...SelectActionFragment
    }
  }

fragment DateOptionFragment on DateOption {
    accessibilityHeading
    accessibilityMessage
    numDaysDifference
    selectAction {
      ...SelectActionFragment
    }
    tripDates
    tripOD
  }

fragment FlightsPointsInformationDialogContent on FlightsPointsInformationDialogContent {
  __typename
  title
  body {
    ...FlightsPointsInformationDialogContentBodyElements
  }
}

fragment FlightsStepIndicator on FlightsStepIndicator {
  errorAnalytics {
    ...FlightsAnalytics
  }
  journeyContinuationId
}

fragment Pagination on Pagination {
  __typename
  size
  startingIndex
}

fragment FlightsPhraseTextNodeFragment on FlightsPhraseTextNode {
  styles
  text
}

fragment EGDSBasicPillFragment on EGDSBasicPill {
    accessibility
    deselectAnalytics {
      ...ClientSideAnalyticsFragment
    }
    disabled
    icon {
      ...UIGraphicFragment
    }
    name
    primary
    selectAnalytics {
      ...ClientSideAnalyticsFragment
    }
    selected
    value
  }

fragment EGDSBasicRemovablePillFragment on EGDSBasicRemovablePill {
    accessibility
    disabled
    icon {
      ...UIGraphicFragment
    }
    name
    primary
    remove {
      ...UIGraphicFragment
    }
    removeAnalytics {
      ...ClientSideAnalyticsFragment
    }
    selected
    value
  }

fragment EGDSDismissActionFragment on EGDSDismissAction {
  accessibility
  analytics {
    ...ClientSideAnalytics
  }
  label
}

fragment FlightsCategorizedListItemFragment on FlightsCategorizedListItem {
  __typename
  primary {
    ...EGDSSpannableTextFragment
  }
  secondary
  secondaryContent {
    ...EGDSSpannableTextFragment
  }
  tertiary
  tertiaryContent {
    ...EGDSStylizedTextFragment
  }
  graphic {
    ...UIGraphicFragment
  }
}

fragment FlightsCriticalErrorMessagingFragment on FlightsCriticalErrorMessaging {
    __typename
    egcsDisplayAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    primaryAction {
      ...FlightsExperienceActionButtonFragment
    }
    icon {
      ...IconFragments
    }
    message
    title
  }

fragment FlightsInfoMessagingPresentationFragment on FlightsInfoMessagingPresentation {
    egcsDisplayAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    icon {
      ...IconFragments
    }
    message
    title
  }

fragment FlightSelectableBaggageFragment on FlightSelectableBaggageAncillaryOption {
    __typename
    description
    disabled
    label
    labelSuffix
    value
    optionType
    selectableAncillaryToken
    selected
  }

fragment FlightsBaggageSelectionAccessibilityMessagesFragment on FlightsBaggageSelectionAccessibilityMessages {
    preSelectionAccessibilityMessage
    preSelectionPerTravelerAccessibilityMessage
    postSelectionAccessibilityMessage
    postSelectionPerTravelerAccessibilityMessage
  }

fragment EGDSNestedLevelOneListFragment on EGDSNestedLevelOneList {
    items {
      ...EGDSNestedLevelOneListItemFragment
    }
  }

fragment EGDSMoreInfoTriggerComponentFragment on EGDSMoreInfoTrigger {
    icon {
      ...IconFragments
    }
    text
    triggerAction {
      accessibility
      analytics {
        ...ClientSideAnalyticsFragment
      }
      sheet {
        ...EGDSSheetFragment
      }
      text
    }
    analytics {
      ...ClientSideAnalyticsFragment
    }
    accessibility
  }

fragment FlightShoppingCardDurationTimelineFragment on FlightShoppingCardDurationTimeline {
  __typename
  start {
    ...FlightShoppingDurationTimelineSideSectionFragment
  }
  end {
    ...FlightShoppingDurationTimelineSideSectionFragment
  }
  stops
  theme
  primaryMessage {
    ... on EGDSStylizedText {
      text
      weight
    }
  }
  secondaryMessage {
    ...EGDSTextSectionFragment
  }
}

fragment EGDSTextSectionFragment on EGDSTextSection {
  __typename
  contents {
    __typename
    ...EGDSStylizedAndSpannable
  }
  heading {
    __typename
    ...EGDSSectionHeadingFragment
  }
}

fragment FlightsJourneyHeaderFragment on FlightsJourneyHeaderInformation {
  __typename
  content {
    ...FlightsInformationTextFragment
  }
}

fragment FlightsJourneyDetailsInformationFragment on FlightsJourneyDetailsInformation {
  __typename
  content {
    ...FlightsJourneyDetailsFragment
  }
  expando {
    ...EGDSExpandoFragment
  }
}

fragment FlightsJourneyWithDetailsFragment on FlightsJourneyWithDetails {
  __typename
  details {
    ...EgdsTextFragment
  }
  footnotes {
    ...EgdsTextFragment
  }
  header
  subheader
}

fragment FlightsFaresInformationFragment on FlightsFaresInformation {
  __typename
  accessibility
  faresScrollDirection
  carousel {
    ...EGDSCarouselContainerFragment
  }
  faresCarousel {
    ...EGDSCarouselFragment
  }
  heading
  fares {
    ...FareInformationCardFragment
  }
  subheading
  scrollAnalytics {
    ...ClientSideAnalytics
  }
  faresScrollAnalytics {
    ...FlightsFaresScrollAnalytics
  }
  totalFareCount
  faresLoadingAnalytics {
    faresLoadErrorAnalytics {
      ...ClientSideAnalytics
    }
    faresLoadingDisplayedAnalytics {
      ...ClientSideAnalytics
    }
    faresLoadingTimeAnalytics {
      ...ClientSideAnalytics
    }
    continueButtonOnClickAnalytics {
      ...ClientSideAnalytics
    }
  }
}

fragment FlightsSustainabilityCardFragment on FlightsSustainabilityCard {
  __typename
  cardContent {
    text {
      ...FlightsPhrase
    }
    icon {
      ...IconSearch
    }
  }
}

fragment FlightsMessagingCardFragment on FlightsMessagingCard {
  cardContent {
    ...EGDSStandardMessagingCardFragment
  }
  displayAnalytics {
    ...ClientSideAnalytics
  }
}

fragment FlightsActionButton on FlightsActionButton {
  __typename
  accessibility
  clientAction {
    __typename
    accessibility
    analyticsList {
      ...ClientSideAnalytics
    }
    ...FlightsBoundNavigation
    ...FlightsCreditSelectorOpenAction
    ...FlightsNavigateToDetails
    ...FlightsResourceLinkAction
    ...FlightsSelectionAction
    ...MultiItemSelectPackage
    ...MultiItemSelectProducts
  }
  disabled
  egdsElementId
  icon {
    ...IconSearch
  }
  primary
  style
  buttonStyle: style
  action {
    __typename
    accessibility
    analytics {
      ...ClientSideAnalytics
    }
  }
}

fragment PriceLockupFragment on EGDSPriceLockup {
  accessibilityPrice
  leadingCaption
  lockupFormattedPoints
  isPointsFirst
  isStrikeThroughFirst
  lockupPrice
  priceSubtextFirst
  priceSubtextBold
  priceSubtextStandard
  strikeThroughPrice
}

fragment EgdsTextFragment on EGDSText {
  __typename
  ... on EGDSGraphicText {
    ...EGDSGraphicTextFragment
  }
  ... on EGDSHeading {
    text
    headingType
  }
  ... on EGDSParagraph {
    ...EGDSParagraphFragment
  }
  ... on EGDSIconText {
    text
    icon {
      id
      size
      theme
    }
  }
  ... on EGDSStandardLink {
    text
    size
    action {
      __typename
      accessibility
      target
      resource {
        __typename
        value
      }
      analytics {
        __typename
        linkName
        referrerId
      }
    }
  }
  ... on EGDSPlainText {
    text
  }
  ... on EGDSStylizedText {
    decorative
    text
    accessibility
    theme
    weight
    stylizedSize: size
  }
  ... on EGDSSpannableText {
    ...EGDSSpannableTextFragment
  }
}

fragment EGDSBasicTabFragment on EGDSBasicTab {
  tabId
  label
  accessibility
  clickAnalytics {
    ...ClientSideAnalyticsFragment
  }
  __typename
}

fragment EGDSDialogFragment on EGDSDialog {
  closeAnalytics {
    ...ClientSideAnalytics
  }
  ...EGDSFullScreenDialogFragment
  ... on EGDSActionDialog {
    __typename
    footer {
      __typename
      buttons {
        ...EGDSButtonFragment
      }
    }
  }
}

fragment EgdsElementFragment on EGDSElement {
  __typename
  ... on EGDSText {
    ...EgdsTextFragment
  }
  ... on Illustration {
    ...EgdsGraphicIllustrationFragmentSearch
  }
  ... on UIMessagingCard {
    primary
    secondaries
    graphic {
      __typename
      ... on Illustration {
        link: url
      }
      ...EgdsGraphicIllustrationFragmentSearch
    }
  }
  ... on EGDSBulletedList {
    listItems {
      __typename
      text
    }
  }
  ... on EGDSUnorderedList {
    listItems {
      __typename
      ... on EGDSTextStandardListItem {
        text
      }
      ... on EGDSTextIconListItem {
        text
        icon {
          ...IconFragment
        }
      }
      ... on FlightsTextContainerListItem {
        content {
          ...EgdsTextFragment
        }
      }
    }
    textListSize: size
  }
}

fragment FlightsDetailSheetFragment on FlightsDetailSheet {
  title
  closeAnalytics {
    ...ClientSideAnalytics
  }
  content {
    ...EgdsElementFragment
  }
  footer {
    ...EgdsElementFragment
  }
  initialState
  closeText
  actions {
    ...EGDSToolbarActionButtonFragment
  }
  sheetType
  __typename
}

fragment EGDSExpandoPeekFragment on EGDSExpandoPeek {
  __typename
  expandedLabel
  collapsedLabel
  expandAnalytics {
    ...ClientSideAnalytics
  }
  collapseAnalytics {
    ...ClientSideAnalytics
  }
  threshold
  minimalHeight
}

fragment EGDSExpandoListItemFragment on EGDSExpandoListItem {
  __typename
  collapseAnalytics {
    ...ClientSideAnalytics
  }
  collapsedLabel
  expandAnalytics {
    ...ClientSideAnalytics
  }
  expandedLabel
  expanded
}

fragment EGDSExpandoLinkFragment on EGDSExpandoLink {
  __typename
  collapseAnalytics {
    ...ClientSideAnalytics
  }
  collapsedLabel
  expandAnalytics {
    ...ClientSideAnalytics
  }
  expanded
  expandedLabel
}

fragment EGDSActionDialogFragment on EGDSActionDialog {
  __typename
  footer {
    ...EGDSActionDialogFooter
  }
}

fragment FlightsBoundNavigation on FlightsBoundNavigation {
  jcid
  mipt
  misId: multiItemSessionId
  pageId
  stepIndicatorJcid
}

fragment FlightsNavigateToDetails on FlightsNavigateToDetails {
  dialogId
  nextPage {
    ...HttpURI
  }
  packagesUrl {
    ...HttpURI
  }
}

fragment FlightsResourceLinkAction on FlightsResourceLinkAction {
  __typename
  accessibility
  analyticsList {
    ...ClientSideAnalytics
  }
  resource {
    ...HttpURI
  }
}

fragment MultiItemSelectPackage on MultiItemSelectPackage {
  packageOfferId
}

fragment MultiItemSelectProducts on MultiItemSelectProducts {
  flightsOfferNaturalKeys {
    ...FlightsOfferNaturalKeysFragment
  }
  multiItemPriceToken
  multiItemSessionId
}

fragment SelectActionFragment on FlightsAction {
    ...FlightsActionFragment
    journeySearchCriteria {
      ...JourneySearchCriteriaFragment
    }
  }

fragment FlightsPointsInformationDialogContentBodyElements on FlightsPointsInformationDialogContentBodyElements {
  __typename
  ...EGDSStylizedText
  ...EGDSSpannableTextFragment
  ...FlightsPointsEqualityPresentation
}

fragment EGDSNestedLevelOneListItemFragment on EGDSNestedLevelOneListItem {
    text
  }

fragment FlightShoppingDurationTimelineSideSectionFragment on FlightShoppingDurationTimelineSideSection {
  primary
  differentDayArrival
  secondary {
    ...FlightsResponsiveMessage
  }
}

fragment EGDSStylizedAndSpannable on EGDSText {
  __typename
  ... on EGDSStylizedText {
    text
    size
    weight
    theme
  }
  ... on EGDSSpannableText {
    text
    inlineContent {
      __typename
      ... on EGDSStylizedText {
        accessibility
        text
        size
        weight
        theme
      }
    }
  }
}

fragment EGDSSectionHeadingFragment on EGDSSectionHeading {
  heading {
    ...EGDSHeadingFragment
  }
  subheading
  ... on FlightsOfferSectionHeading {
    mark {
      ...MarkFragments
    }
  }
  ... on EGDSBasicSectionHeading {
    graphic {
      ...UIGraphicFragment
    }
  }
}

fragment FlightsInformationTextFragment on FlightsInformationText {
  __typename
  content {
    ...FlightsInformationTextItemFragment
  }
}

fragment FlightsJourneyDetailsFragment on FlightsJourneyDetails {
  __typename
  trigger {
    ...FlightsExperienceDialogTrigger
  }
  dialog {
    ...FaresDialogsFragment
  }
  journeySections {
    ...JourneySectionFragment
  }
  journeyAmenities {
    ...FlightsIconAndLabel
  }
  badge {
    ...JourneyDetailsBadgeFragment
  }
}

fragment EGDSCarouselContainerFragment on EGDSCarouselContainer {
  __typename
  accessibilityHeadingText
  nextButtonText
  previousButtonText
}

fragment EGDSCarouselFragment on EGDSCarousel {
  nextButton {
    ...EGDSButtonFragment
  }
  previousButton {
    ...EGDSButtonFragment
  }
}

fragment FareInformationCardFragment on FareInformationCard {
  __typename
  action {
    ...FareActionFragment
    clickAdaptExAnalytics {
      ...FlightsAdaptExAnalyticsFragment
    }
  }
  amenities {
    ...FlightsCategorizedListFragment
  }
  fareDetails {
    ...EgdsTextFragment
  }
  featuredHeader
  heading {
    ...FareHeadingFragmentSearch
  }
  fareMessage {
    decorative
    text
    theme
    weight
    stylizedSize: size
  }
  priceMatchPromise {
    ...FarePriceMatchPromisePresentationFragment
  }
  state
  highlighted
  fareCardIdentifier
  scrollAnalytics {
    ...ClientSideAnalytics
  }
  sponsoredContent {
    __typename
  }
  isPopularFare
  journeyContinuationId
  displayAdaptExAnalytics {
    ...FlightsAdaptExAnalyticsFragment
  }
}

fragment FlightsFaresScrollAnalytics on FlightsFaresScrollAnalytics {
  scrollUp {
    ...ClientSideAnalytics
  }
  scrollDown {
    ...ClientSideAnalytics
  }
  scrollDownButtonClick {
    ...ClientSideAnalytics
  }
}

fragment FlightsPhrase on FlightsPhrase {
  completeText
  delimeter
  theme
  items {
    __typename
    text
    styles
    ... on FlightsPhraseLinkNode {
      accessibility
      analytics {
        ...FlightsAnalytics
      }
      displayAnalytics {
        ...FlightsAnalytics
      }
      scrollAnalytics {
        ...FlightsAnalytics
      }
      link
      icon
    }
    ... on FlightsPhraseDialogNode {
      accessibility
      analytics {
        ...FlightsAnalytics
      }
      actionableIcon {
        id
        description
      }
      dialog {
        __typename
        title
        message
        animation
        actions {
          ...FlightAction
        }
        displayedAnalytics {
          ...FlightsAnalytics
        }
      }
    }
  }
}

fragment FlightsCreditSelectorOpenAction on FlightsCreditSelectorOpenAction {
  __typename
  accessibility
  analyticsList {
    ...ClientSideAnalytics
  }
}

fragment EGDSFullScreenDialogFragment on EGDSFullScreenDialog {
  ... on EGDSFullScreenDialog {
    toolbar {
      ...EGDSDialogToolbarFragment
    }
  }
}

fragment EGDSToolbarActionButtonFragment on EGDSToolbarActionButton {
  ...EGDSOverlayButtonTypeFragment
}

fragment EGDSActionDialogFooter on EGDSDialogFooter {
  __typename
  buttons {
    ...UITertiaryButtonFragment
    ... on FlightsActionButton {
      __typename
      style
      primary
      clientAction {
        analyticsList {
          ...ClientAnalytics
        }
        ... on FlightsRemovePriceMatchPromiseAction {
          journeyContinuationId
        }
      }
    }
  }
}

fragment HttpURI on HttpURI {
  __typename
  relativePath
  value
}

fragment FlightsOfferNaturalKeysFragment on FlightsOfferNaturalKeys {
  flightNaturalKey {
    offerToken
    productTokens
    travelers {
      age
      type
    }
    journeyContinuationId
  }
  packagedProductsNaturalKeys {
    __typename
    ... on CarNaturalKey {
      __typename
      offerToken
    }
    ... on PropertyNaturalKey {
      __typename
      id
      ratePlanId
      roomTypeId
      ratePlanType
      inventoryType
      checkOut {
        ...DateFragment
      }
      checkIn {
        ...DateFragment
      }
      rooms {
        childAges
        numberOfAdults
      }
      businessModelType
    }
  }
}

fragment JourneySearchCriteriaFragment on FlightsJourneySearchCriteria {
    previousFlightSelections {
      journeyIndex
      offerIdentifier
    }
    journeyCriteria {
      originAirportLocationType
      destinationAirportLocationType
      destination
      departureDate {
        day
        month
        year
      }
      origin
    }
    searchPreferences {
      cabinClass
    }
  }

fragment EGDSStylizedText on EGDSStylizedText {
  __typename
  text
  theme
  stylizedSize: size
  accessibility
  weight
  decorative
}

fragment FlightsPointsEqualityPresentation on FlightsPointsEqualityPresentation {
  __typename
  delimiter {
    ...EGDSStylizedText
  }
  primaryText {
    ...EGDSStylizedText
  }
  secondarySubText {
    ...EGDSStylizedText
  }
  secondaryText {
    ...EGDSStylizedText
  }
  subText {
    ...EGDSStylizedText
  }
}

fragment FlightsResponsiveMessage on FlightsResponsiveMessage {
  __typename
  longMessage
  shortMessage
}

fragment FlightsInformationTextItemFragment on FlightsInformationTextItem {
  ...MarkWrapperFragment
  ...TextWrapperFragment
  ...IconWrapperFragment
  ...SuperlativeTextFragment
  ...BadgeWrapperFragment
}

fragment FlightsExperienceDialogTrigger on FlightsExperienceDialogTrigger {
  dialogAction
  dialogId
  dynamicDialogId
  trigger {
    ...FlightsExperienceActionLinkFragment
    ...FlightsExperienceActionButtonFragment
  }
}

fragment JourneySectionFragment on JourneySection {
  __typename
  journeyConnectionInformation {
    ... on AdditionalInformation {
      ...AdditionalInformationFragment
    }
    ... on FlightsConnectionInformation {
      ...FlightsConnectionInformationFragment
    }
  }
  sectionLabel {
    ...EgdsTextFragment
  }
  messageList {
    ...EgdsTextFragment
  }
}

fragment FlightsIconAndLabel on FlightsIconAndLabel {
  __typename
  icon {
    ...IconSearch
  }
  label
  subLabel
  accessibility
  value
  theme
  displayAnalytics {
    ...FlightsAnalytics
  }
  subText {
    ... on EGDSStylizedText {
      decorative
      text
      theme
      weight
      size
    }
  }
}

fragment JourneyDetailsBadgeFragment on JourneyDetailsBadge {
  badge {
    ...EGDSBadgeFragment
  }
  link {
    ...EGDSStandardLinkFragment
  }
  label {
    ...EGDSPlainTextFragment
  }
}

fragment FareActionFragment on FareAction {
  __typename
  action {
    ...FlightsActionButton
  }
  states
}

fragment FlightsAdaptExAnalyticsFragment on FlightsAdaptExAnalytics {
  campaignId
  events {
    banditDisplayed
    eventProperties {
      name
      value
    }
    eventTarget
    eventType
    payloadId
  }
}

fragment FlightsCategorizedListFragment on FlightsCategorizedList {
  __typename
  sections {
    ...FlightsCategorizedListSectionFragment
  }
  expandableSection {
    ...FlightsExpandableCategorizedListSectionFragment
  }
}

fragment FareHeadingFragmentSearch on FareHeading {
  __typename
  badge {
    ...EGDSBadgeFragment
  }
  farePricing {
    ...FarePricingFragment
  }
}

fragment FarePriceMatchPromisePresentationFragment on FarePriceMatchPromisePresentation {
  __typename
  cards {
    ...FarePriceMatchPromiseSelectableCardFragment
    ...FarePriceMatchPromiseRemovableCardFragment
    ...FarePriceMatchPromiseStaticCardFragment
  }
  priceMatchPromiseState
}

fragment EGDSDialogToolbarFragment on EGDSDialogToolbar {
  title
  closeText
}

fragment EGDSOverlayButtonTypeFragment on EGDSOverlayButton {
  accessibility
  primary
  disabled
  egdsElementId
  action {
    ...UILinkActionFragment
  }
  analytics {
    ...ClientSideAnalytics
  }
  icon {
    ...IconFragment
  }
}

fragment UITertiaryButtonFragment on UITertiaryButton {
  __typename
  disabled
  primary
  action {
    ... on UIFlightAction {
      __typename
      analytics {
        ...ClientAnalytics
      }
    }
  }
}

fragment MarkWrapperFragment on MarkWrapper {
  __typename
  mark {
    ...MarkFragments
  }
}

fragment IconWrapperFragment on IconWrapper {
  __typename
  iconA11yMessage: accessibilityMessage
  icons {
    ...IconSearch
  }
}

fragment SuperlativeTextFragment on SuperlativeText {
  __typename
  superlativeTextA11yMessage: accessibilityMessage
  text {
    ...EgdsTextFragment
  }
}

fragment BadgeWrapperFragment on BadgeWrapper {
  __typename
  badge {
    ...EGDSBadgeFragment
  }
}

fragment AdditionalInformationFragment on AdditionalInformation {
  __typename
  durationAndStop
  nextFlightOriginAirportInfo {
    ...FlightsIconAndLabel
  }
  layoverInfo {
    ...FlightsIconAndLabelFragment
  }
}

fragment FlightsConnectionInformationFragment on FlightsConnectionInformation {
  __typename
  flightsConnection {
    aircraftModel
    airlineInfo
    cabinClassAndBookingCode
    detailList {
      ...FlightsLabelAndValueFragment
    }
    connectionArrival {
      ...CoordinateInformationSearch
    }
    connectionDeparture {
      ...CoordinateInformationSearch
    }
    duration
    durationAccessibilityMessage
    journeyAmenities {
      ...FlightsJourneyAmenities
    }
    airlineDetails {
      ...FlightsMarkPhrasesFragment
    }
    badge {
      ...JourneyDetailsBadgeFragment
    }
    flightInfoLinks {
      ...FlightsLabelAndLinkFragment
    }
  }
}

fragment FlightsCategorizedListSectionFragment on FlightsCategorizedListSection {
  __typename
  flightsCategorizedListSectionA11yMessage: accessibilityMessage
  footnote
  heading
  additionalInfo
  items {
    ...FlightsCategorizedListItemFragment
  }
}

fragment FlightsExpandableCategorizedListSectionFragment on FlightsExpandableCategorizedListSection {
  __typename
  expando {
    ...EGDSExpandoFragment
  }
  expandoContent {
    ...FlightsCategorizedListSectionFragment
  }
}

fragment FarePricingFragment on FarePricing {
  __typename
  priceDisplay {
    ...FlightsPriceDisplayFragment
  }
  priceLockup {
    ...PriceLockupFragment
  }
  states
}

fragment FarePriceMatchPromiseSelectableCardFragment on FarePriceMatchPromiseSelectableCard {
  __typename
  checkbox {
    ...FlightsActionCheckboxFragment
  }
  headingSection {
    ...PriceMatchPromiseCardHeadingFragment
  }
  infoTrigger {
    ...FlightsDialogTriggerFragment
  }
  descriptionDetailsLinkTrigger {
    ...FlightsDialogTriggerFragment
  }
  price
  priceMatchPromiseState
  description
}

fragment FarePriceMatchPromiseRemovableCardFragment on FarePriceMatchPromiseRemovableCard {
  __typename
  heading {
    ...EGDSIconTextFragment
  }
  priceMatchPromiseState
  removeAction {
    ...FlightsActionLinkFragment
  }
  subHeading
}

fragment FarePriceMatchPromiseStaticCardFragment on FarePriceMatchPromiseStaticCard {
  __typename
  heading {
    ...EGDSIconTextFragment
  }
  priceMatchPromiseState
  subHeading
}

fragment FlightsIconAndLabelFragment on FlightsIconAndLabel {
  __typename
  icon {
    ...IconFragment
  }
  label
  subLabel
  accessibility
  value
  theme
  displayAnalyticsList {
    ...ClientSideAnalytics
  }
  subText {
    ... on EGDSStylizedText {
      decorative
      text
      theme
      weight
      size
    }
  }
}

fragment FlightsLabelAndValueFragment on FlightsLabelAndValue {
  __typename
  label
  value
  accessibilityMessage
}

fragment CoordinateInformationSearch on CoordinateInformation {
  icon {
    ...IconSearch
  }
  flightDetailsWarningInfo {
    ...FlightsIconAndLabel
  }
  subtitle
  titleAndAccessibilityMessage {
    flightsMessageAndAccessibilityA11yMessage: accessibilityMessage
    text
  }
  terminal {
    ...EgdsTextFragment
  }
  journeyDateTime {
    ...EgdsTextFragment
  }
  isLayoverAirport
}

fragment FlightsJourneyAmenities on FlightsJourneyAmenities {
  __typename
  accessibilityMessage
  title {
    ...EGDSStylizedTextFragment
  }
  amenities {
    ...FlightsIconAndLabel
  }
  analytics {
    ...FlightsAnalytics
  }
}

fragment FlightsMarkPhrasesFragment on FlightsMarkPhrases {
  accessibility
  mark {
    ...MarkFragments
  }
  text {
    accessibility
    completeText
    items {
      ...FlightsPhrasePartFragment
    }
  }
}

fragment FlightsLabelAndLinkFragment on FlightsLabelAndLink {
  label {
    ...EGDSSpannableTextFragment
  }
  linkInfo {
    ...FlightsExperienceActionLinkFragment
  }
}

fragment FlightsActionCheckboxFragment on FlightsActionCheckbox {
  label {
    ...EgdsTextFragment
  }
  clientAction {
    ...FlightsClickActionFragment
    ...InsuranceSwitchToggleAction
  }
  checkedAccessibility
  checkedAnalytics {
    ...ClientSideAnalytics
  }
  uncheckedAccessibility
  uncheckedAnalytics {
    ...ClientSideAnalytics
  }
}

fragment PriceMatchPromiseCardHeadingFragment on FarePriceMatchPromiseCardHeadingType {
  __typename
  ...EGDSBasicSectionHeadingFragment
  ...EGDSGraphicTextFragment
}

fragment FlightsClickActionFragment on FlightsClickAction {
  __typename
  analyticsList {
    __typename
    ...ClientSideAnalytics
  }
  accessibility
}

fragment InsuranceSwitchToggleAction on InsuranceSwitchToggleAction {
  insuranceCriteria {
    freePmpCustomerPlacement
    selectedProductId
  }
  jcidValue: jcid
  checkedAccessibilityAnnouncement
  uncheckedAccessibilityAnnouncement
}

fragment EGDSBasicSectionHeadingFragment on EGDSBasicSectionHeading {
  __typename
  heading {
    __typename
    ...EGDSHeadingFragment
  }
  graphic {
    ...UIGraphicFragment
  }
}`;
